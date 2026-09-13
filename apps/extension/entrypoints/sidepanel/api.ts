import {
  apiErrorSchema,
  speechCapabilities,
  type Locale,
  fieldInterpretResponseSchema,
  speechHelpResponseSchema,
  transcribeResponseSchema,
  valueInterpretResponseSchema,
  type ApiError,
  type FieldContext,
  type FieldInterpretResponse,
  type FormField,
  type HelpTopic,
  type SpeechHelpResponse,
  type TranscribeResponse,
  type ValueInterpretResponse,
} from '@form-saathi/contracts';
import { z } from 'zod';
import { API_ORIGIN } from '../../config';

// The panel's only client for the optional service. Every reply is parsed
// against the shared contract before the panel looks at it, every request has
// its own timeout, and a failure is a bounded code the panel turns into localized text.

export type Failure =
  | ApiError['error']
  | 'no_credential'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'microphone_denied'
  | 'microphone_unavailable'
  | 'nothing_recorded';

export type Outcome<T> = { ok: true; data: T } | { ok: false; failure: Failure };

const REQUEST_TIMEOUT_MS = 20_000;

async function call<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  token: string,
  signal?: AbortSignal,
): Promise<Outcome<T>> {
  if (token === '') return { ok: false, failure: 'no_credential' };
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (signal?.aborted) return { ok: false, failure: 'cancelled' };
    return { ok: false, failure: timeout.aborted ? 'timeout' : 'network' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, failure: 'invalid_response' };
  }
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    return { ok: false, failure: error.success ? error.data.error : 'invalid_response' };
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, failure: 'invalid_response' };
}

/** The minimal, value-free context a person approves sending about a field. */
export function fieldContext(field: FormField): FieldContext {
  return {
    label: field.label.slice(0, 300),
    description: field.description.slice(0, 1000),
    group: field.group.slice(0, 300),
    control: field.constraints.control.slice(0, 40),
    required: field.required,
    pattern: field.constraints.pattern?.slice(0, 200) ?? null,
    options: field.options.slice(0, 40).map((option) => option.label.slice(0, 200)),
  };
}

export function transcribe(audio: Blob, token: string, signal: AbortSignal, locale: Locale = 'en'): Promise<Outcome<TranscribeResponse>> {
  if (speechCapabilities[locale].transcription === null) return Promise.resolve({ ok: false, failure: 'service_not_configured' });
  const form = new FormData();
  form.append('locale', locale);
  form.append('audio', audio, 'recording.webm');
  return call('/v1/speech/transcribe', { method: 'POST', body: form }, transcribeResponseSchema, token, signal);
}

function json(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

export function interpretValue(
  transcript: string,
  field: FormField,
  token: string,
  signal: AbortSignal,
  locale: Locale = 'en',
): Promise<Outcome<ValueInterpretResponse>> {
  if (speechCapabilities[locale].interpretation === null) return Promise.resolve({ ok: false, failure: 'service_not_configured' });
  return call('/v1/values/interpret', json({ locale, transcript, field: fieldContext(field) }), valueInterpretResponseSchema, token, signal);
}

export function interpretField(field: FormField, token: string, signal: AbortSignal, locale: Locale = 'en'): Promise<Outcome<FieldInterpretResponse>> {
  if (speechCapabilities[locale].interpretation === null) return Promise.resolve({ ok: false, failure: 'service_not_configured' });
  return call('/v1/fields/interpret', json({ locale, field: fieldContext(field) }), fieldInterpretResponseSchema, token, signal);
}

export function speechHelp(topic: HelpTopic, token: string, signal: AbortSignal, locale: Locale = 'en'): Promise<Outcome<SpeechHelpResponse>> {
  if (speechCapabilities[locale].interpretation === null) return Promise.resolve({ ok: false, failure: 'service_not_configured' });
  return call('/v1/speech/help', json({ locale, topic }), speechHelpResponseSchema, token, signal);
}

// The pilot credential and the cloud consent live in the session storage
// area: kept for this browser session only, never written to disk, and gone
// when the browser closes. The extension ships neither.

export type Session = { token: string; consent: boolean };

const sessionSchema = z.object({ token: z.string().max(400).catch(''), consent: z.boolean().catch(false) });

export async function loadSession(): Promise<Session> {
  try {
    const stored = await chrome.storage.session.get(['token', 'consent']);
    return sessionSchema.parse(stored);
  } catch {
    return { token: '', consent: false };
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await chrome.storage.session.set(session);
  } catch {
    // Storage is a convenience; the panel keeps working from memory.
  }
}
