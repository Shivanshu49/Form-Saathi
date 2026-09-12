import { z } from 'zod';

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('form-saathi-api'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export * from './messages.js';
export * from './api.js';
