import { z } from 'zod';

// All secrets and model names live here, read from the server's environment.
// Nothing in this file is ever sent to a client or written to a log.

const modelName = z.string().trim().min(1).max(60);

const configSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().trim().min(1).default('127.0.0.1'),
  /** Provider key. Absent means the AI routes answer `service_not_configured`. */
  providerKey: z.string().trim().min(1).optional(),
  /** Signing secret for pilot credentials. Absent disables every /v1 route. */
  pilotSecret: z.string().trim().min(16).optional(),
  providerBaseUrl: z.string().trim().url().default('https://api.sarvam.ai'),
  // Model identifiers are configuration, never literals in the request code.
  // Confirmed against Sarvam's API reference on 2026-09-12: saaras:v3 is the
  // speech-to-text default, sarvam-105b the chat model, bulbul:v3 the TTS
  // default. See docs/source-register.md.
  transcribeModel: modelName.default('saaras:v3'),
  interpretModel: modelName.default('sarvam-105b'),
  speechModel: modelName.default('bulbul:v3'),
  speechSpeaker: z.string().trim().min(1).max(40).default('shubh'),
  /** Upload ceiling for one recording, in bytes. */
  maxAudioBytes: z.coerce.number().int().min(1024).max(25 * 1024 * 1024).default(4 * 1024 * 1024),
  providerTimeoutMs: z.coerce.number().int().min(1000).max(120_000).default(20_000),
  /** Retries after the first attempt, for timeouts and retryable statuses only. */
  providerRetries: z.coerce.number().int().min(0).max(3).default(1),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(600).default(20),
  /** All authentication attempts from one socket address, before token verification. */
  preAuthRateLimitPerMinute: z.coerce.number().int().min(1).max(10_000).default(600),
});

export type Config = z.infer<typeof configSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse({
    port: env['PORT'],
    host: env['HOST'],
    providerKey: env['SARVAM_API_KEY'],
    pilotSecret: env['PILOT_TOKEN_SECRET'],
    providerBaseUrl: env['SARVAM_BASE_URL'],
    transcribeModel: env['SARVAM_TRANSCRIBE_MODEL'],
    interpretModel: env['SARVAM_INTERPRET_MODEL'],
    speechModel: env['SARVAM_SPEECH_MODEL'],
    speechSpeaker: env['SARVAM_SPEECH_SPEAKER'],
    maxAudioBytes: env['MAX_AUDIO_BYTES'],
    providerTimeoutMs: env['PROVIDER_TIMEOUT_MS'],
    providerRetries: env['PROVIDER_RETRIES'],
    rateLimitPerMinute: env['RATE_LIMIT_PER_MINUTE'],
    preAuthRateLimitPerMinute: env['PRE_AUTH_RATE_LIMIT_PER_MINUTE'],
  });
}

export const CONFIG = Symbol('form-saathi-config');
