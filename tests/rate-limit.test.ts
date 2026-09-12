import 'reflect-metadata';
import { afterEach, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { PilotAuthGuard, RateLimitGuard } from '../apps/api/dist/http.js';
import { readConfig } from '../apps/api/dist/config.js';
import { mintPilotToken, verifyPilotToken } from '../apps/api/dist/pilot-token.js';
import { createHmac } from 'node:crypto';

const secret = 'isolated-limiter-test-secret';
const config = readConfig({ PILOT_TOKEN_SECRET: secret, RATE_LIMIT_PER_MINUTE: '2', PRE_AUTH_RATE_LIMIT_PER_MINUTE: '3' });
const token = mintPilotToken('one', 1, secret);

function context(authorization: string, address = '127.0.0.1', subject?: string): ExecutionContext {
  const request = { headers: { authorization }, socket: { remoteAddress: address }, ip: address,
    path: '/v1/fields/interpret', pilot: subject ? { subject, expiresAt: Date.now() / 1000 + 3600 } : undefined };
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => function interpret() {} } as unknown as ExecutionContext;
}

afterEach(() => vi.restoreAllMocks());

it('audit regression: authenticated and pre-authentication windows expire independently', () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  const auth = new PilotAuthGuard(config);
  const rate = new RateLimitGuard(config);
  const run = (header: string) => { const request = context(header); auth.canActivate(request); return rate.canActivate(request); };
  expect(run(`Bearer ${token}`)).toBe(true);
  expect(run(`Bearer  ${token}`)).toBe(true);
  expect(() => run(`Bearer   ${token}`)).toThrow('Too many requests');
  expect(() => run('Bearer unverified')).toThrow('Too many requests');
  clock.mockReturnValue(now + 60_001);
  expect(run(`Bearer\t${token}`)).toBe(true);
  expect(() => run('Bearer unverified')).toThrow('valid, unexpired');
});

it('audit regression: limiter capacity is bounded without evicting live allowances', () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  const auth = new PilotAuthGuard(config);
  const rate = new RateLimitGuard(config);
  for (let index = 0; index < 10_000; index += 1) {
    expect(() => auth.canActivate(context('Bearer invalid', `peer-${index}`))).toThrow('valid, unexpired');
    expect(rate.canActivate(context('Bearer invalid', '127.0.0.1', `verified-${index}`))).toBe(true);
  }
  expect(() => auth.canActivate(context('Bearer another', 'overflow'))).toThrow('Too many requests');
  expect(() => rate.canActivate(context('', '127.0.0.1', 'overflow'))).toThrow('Too many requests');
  expect(rate.canActivate(context('', '127.0.0.1', 'verified-0'))).toBe(true);
  expect(() => rate.canActivate(context('', '127.0.0.1', 'verified-0'))).toThrow('Too many requests');
  clock.mockReturnValue(now + 60_001);
  expect(() => auth.canActivate(context('Bearer another', 'overflow'))).toThrow('valid, unexpired');
  expect(rate.canActivate(context('', '127.0.0.1', 'overflow'))).toBe(true);
});

it('keeps signed expiry claims finite and integral', () => {
  for (const exp of ['1e400', '9999999999.5']) {
    const payload = Buffer.from(`{"sub":"one","exp":${exp}}`).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    expect(verifyPilotToken(`fs1.${payload}.${signature}`, secret)).toBeNull();
  }
});
