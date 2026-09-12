import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { healthResponseSchema } from '@form-saathi/contracts';
import { livePortalSupport } from '@form-saathi/rules';
import { AppModule } from '../apps/api/dist/app.module.js';

describe('compiled ESM API', () => {
  let app: NestExpressApplication;
  let origin: string;

  beforeAll(async () => {
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

  it('does not expose an unfinished AI endpoint', async () => {
    const response = await fetch(`${origin}/v1/fields/interpret`, { method: 'POST' });
    expect(response.status).toBe(404);
  });
});
