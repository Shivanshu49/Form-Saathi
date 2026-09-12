import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './index.js';

describe('health response contract', () => {
  it('accepts the service response', () => {
    expect(healthResponseSchema.parse({ status: 'ok', service: 'form-saathi-api' }))
      .toEqual({ status: 'ok', service: 'form-saathi-api' });
  });

  it('rejects missing, incorrect, and unexpected response data', () => {
    for (const response of [
      null,
      {},
      { status: 'ok', service: 'another-service' },
      { status: 'down', service: 'form-saathi-api' },
      { status: 'ok', service: 'form-saathi-api', formValues: {} },
    ]) {
      expect(healthResponseSchema.safeParse(response).success).toBe(false);
    }
  });
});
