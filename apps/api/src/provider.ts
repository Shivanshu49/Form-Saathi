import { z } from 'zod';
import type { Config } from './config.js';
import { ApiFailure } from './http.js';

// The provider boundary. Everything Sarvam-specific lives behind this
// interface so another provider can replace it without touching a controller.
// Requests follow Sarvam's API reference as retrieved on 2026-09-12; see
// docs/source-register.md for the exact pages and quotes.

export const PROVIDER = Symbol('form-saathi-ai-provider');

export type AudioUpload = { bytes: Buffer; filename: string; contentType: string };

export type Transcription = { transcript: string; languageCode: string | null };

export interface AiProvider {
  transcribe(audio: AudioUpload, signal: AbortSignal): Promise<Transcription>;
  /** Returns model output already validated against `schema`, or throws. */
  interpret<T>(request: InterpretRequest<T>, signal: AbortSignal): Promise<T>;
  synthesize(text: string, signal: AbortSignal): Promise<string>;
}

export type InterpretRequest<T> = {
  system: string;
  user: string;
  schemaName: string;
  schema: z.ZodType<T>;
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

const transcriptionResponse = z.object({
  transcript: z.string().max(20_000).nullish(),
  language_code: z.string().max(20).nullish(),
});

const chatResponse = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().max(20_000).nullish() }),
  })).min(1),
});

const speechResponse = z.object({
  audios: z.array(z.string().max(8_000_000)).min(1),
});

/** A JSON schema when the contract can express one, plain JSON mode otherwise. */
function responseFormat<T>(request: InterpretRequest<T>): unknown {
  try {
    return {
      type: 'json_schema',
      json_schema: { name: request.schemaName, schema: z.toJSONSchema(request.schema), strict: true },
    };
  } catch {
    return { type: 'json_object' };
  }
}

function cancelled(): ApiFailure {
  return new ApiFailure(499, 'cancelled', 'The request was cancelled.');
}

/** A retry backoff that ends as soon as the caller leaves. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export class SarvamProvider implements AiProvider {
  constructor(private readonly config: Config) {}

  private key(): string {
    if (this.config.providerKey === undefined) {
      throw new ApiFailure(503, 'service_not_configured', 'This deployment has no language service configured.');
    }
    return this.config.providerKey;
  }

  /**
   * One attempt plus bounded retries, each with its own timeout. The caller's
   * signal aborts the attempt in flight, including its body read, cuts a
   * backoff short, and stops any further attempt: the top of the loop checks
   * it before every request.
   */
  private async send(path: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    const key = this.key();
    for (let attempt = 0; ; attempt += 1) {
      if (signal.aborted) throw cancelled();
      const timeout = AbortSignal.timeout(this.config.providerTimeoutMs);
      try {
        const response = await fetch(`${this.config.providerBaseUrl}${path}`, {
          ...init,
          headers: {
            ...init.headers,
            // Sarvam accepts the subscription key header on every route and a
            // bearer token on chat; sending both keeps one code path.
            'api-subscription-key': key,
            authorization: `Bearer ${key}`,
          },
          signal: AbortSignal.any([signal, timeout]),
        });
        if (response.ok) return response;
        if (RETRYABLE.has(response.status) && attempt < this.config.providerRetries) {
          await wait(200 * (attempt + 1), signal);
          continue;
        }
        // The status is useful to an operator; the body may quote the request.
        throw new ApiFailure(502, 'provider_unavailable', `The language service returned ${response.status}.`);
      } catch (error) {
        if (error instanceof ApiFailure) throw error;
        // A caller who left is not a provider failure, and is never retried.
        if (signal.aborted) throw cancelled();
        if (attempt < this.config.providerRetries) {
          await wait(200 * (attempt + 1), signal);
          continue;
        }
        throw new ApiFailure(502, 'provider_unavailable', 'The language service did not respond in time.');
      }
    }
  }

  private async json(response: Response, signal: AbortSignal): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      // Aborting the signal also drops a body still arriving; that is not a bad reply.
      if (signal.aborted) throw cancelled();
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service returned an unreadable reply.');
    }
  }

  async transcribe(audio: AudioUpload, signal: AbortSignal): Promise<Transcription> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio.bytes)], { type: audio.contentType }), audio.filename);
    form.append('model', this.config.transcribeModel);
    form.append('language_code', 'hi-IN');
    const response = await this.send('/speech-to-text', { method: 'POST', body: form }, signal);
    const parsed = transcriptionResponse.safeParse(await this.json(response, signal));
    if (!parsed.success) {
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service returned an unexpected reply.');
    }
    return { transcript: parsed.data.transcript ?? '', languageCode: parsed.data.language_code ?? null };
  }

  async interpret<T>(request: InterpretRequest<T>, signal: AbortSignal): Promise<T> {
    const response = await this.send('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.config.interpretModel,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        response_format: responseFormat(request),
      }),
    }, signal);
    const parsed = chatResponse.safeParse(await this.json(response, signal));
    const content = parsed.success ? parsed.data.choices[0]?.message.content ?? '' : '';
    if (content === '') {
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service returned an empty reply.');
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch {
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service did not return usable JSON.');
    }
    const result = request.schema.safeParse(decoded);
    if (!result.success) {
      // Malformed structure is rejected outright: no partial suggestion is kept.
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service reply did not match the contract.');
    }
    return result.data;
  }

  async synthesize(text: string, signal: AbortSignal): Promise<string> {
    const response = await this.send('/text-to-speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        language_code: 'hi-IN',
        model: this.config.speechModel,
        speaker: this.config.speechSpeaker,
        output_audio_codec: 'wav',
      }),
    }, signal);
    const parsed = speechResponse.safeParse(await this.json(response, signal));
    if (!parsed.success || parsed.data.audios[0] === undefined) {
      throw new ApiFailure(502, 'provider_response_invalid', 'The language service returned no audio.');
    }
    return parsed.data.audios[0];
  }
}
