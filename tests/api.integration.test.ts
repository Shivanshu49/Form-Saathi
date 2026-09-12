import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiErrorSchema, healthResponseSchema } from '@form-saathi/contracts';
import { livePortalSupport } from '@form-saathi/rules';
import { AppModule } from '../apps/api/dist/app.module.js';

describe('compiled ESM API', () => {
  let app: NestExpressApplication;
  let origin: string;

  beforeAll(async () => {
    // An unconfigured deployment: no pilot secret and no provider key.
    delete process.env['PILOT_TOKEN_SECRET'];
    delete process.env['SARVAM_API_KEY'];
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves a real health response using the shared contract', async () => {
    const response = await fetch(`${origin}/health`);
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json()))
      .toEqual({ status: 'ok', service: 'form-saathi-api' });
    expect(app.getHttpAdapter().getType()).toBe('express');
  });

  it('loads the rules package in Node without claiming live support', () => {
    expect(livePortalSupport).toEqual({ nsp: 'unverified', eciForm6: 'unverified' });
  });

  it('keeps the AI routes closed until a deployment configures them', async () => {
    const response = await fetch(`${origin}/v1/fields/interpret`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(503);
    expect(apiErrorSchema.parse(await response.json()).error).toBe('service_not_configured');
  });
});
