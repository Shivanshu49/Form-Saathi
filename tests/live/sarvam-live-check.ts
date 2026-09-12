import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  apiErrorSchema,
  fieldInterpretResponseSchema,
  speechHelpResponseSchema,
  transcribeResponseSchema,
  valueInterpretResponseSchema,
  type FieldContext,
} from '@form-saathi/contracts';
import { validateSnapshot, type ValidationField } from '@form-saathi/rules';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { readConfig } from '../../apps/api/dist/config.js';
import { mintPilotToken } from '../../apps/api/dist/pilot-token.js';
import { SarvamProvider } from '../../apps/api/dist/provider.js';

// Live provider verification: the compiled service, booted in this process on
// a loopback port, talking to the real Sarvam API with the key from the
// environment. Run only with an authorized server-side key:
//
//   npm run build --workspace @form-saathi/api
//   node --env-file-if-exists=.env tests/live/sarvam-live-check.ts
//
// Everything sent is fictional. The recording, unless FORM_SAATHI_LIVE_AUDIO
// names an approved WAV or WebM file, is synthesized from fictional Hindi text
// through the same adapter. Nothing is written to disk, the key is never
// printed, and no government identifier, document, password, OTP or form
// snapshot is involved. Record the printed table in docs/testing.md.

type Outcome = { name: string; ok: boolean; ms: number; note: string };

const DOB_FIELD: FieldContext = {
  label: 'जन्म तारीख (अभ्यास में आवश्यक)',
  description: 'दिन/महीना/वर्ष, जैसे 15/08/2000। यह जाँच केवल तारीख की होगी; मतदाता पात्रता तय नहीं होती।',
  group: '2. जन्म तारीख और आयु का दस्तावेज़',
  control: 'text',
  required: true,
  pattern: null,
  options: [],
};
const UNAMBIGUOUS = 'पंद्रह अगस्त दो हज़ार';
const AMBIGUOUS = 'पंद्रह अगस्त';

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await work();
  return { value, ms: Math.round(performance.now() - started) };
}

async function errorCode(response: Response): Promise<string> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : 'unparseable error body';
  } catch {
    return 'no JSON body';
  }
}

/** Checks a suggested date exactly as the panel does: with the local rule pack. */
function localCheck(value: string): string {
  const field = (key: string, val: string): ValidationField => ({
    fieldId: key, key, label: key, kind: 'text', status: 'read', required: false, value: val, options: [],
    constraints: { control: 'text', min: null, max: null },
  });
  const findings = validateSnapshot({
    origin: 'http://127.0.0.1:4173',
    fields: [field('eci-name-hi', 'अभ्यास'), field('eci-age-proof', 'other'), field('eci-dob', value)],
    gaps: [],
    reference: { englishName: '' },
  }).filter((result) => result.fieldId === 'eci-dob');
  return findings.length === 0 ? 'local date rules: no finding' : `local date rules: ${findings.map((result) => result.ruleId).join(', ')}`;
}

async function main(): Promise<number> {
  if (!process.env['SARVAM_API_KEY']) {
    console.error('SARVAM_API_KEY is not set. Configure it server-side in .env or the environment; never paste it into a chat.');
    return 2;
  }
  if (!process.env['PILOT_TOKEN_SECRET']) process.env['PILOT_TOKEN_SECRET'] = randomBytes(24).toString('hex');
  const secret = process.env['PILOT_TOKEN_SECRET'];
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const token = mintPilotToken('live-check', 1, secret);
  const results: Outcome[] = [];
  const record = (name: string, ok: boolean, ms: number, note: string) => results.push({ name, ok, ms, note });
  const post = (path: string, body: unknown, auth = token, signal?: AbortSignal) => fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth}` },
    body: JSON.stringify(body),
    signal: signal ?? null,
  });

  try {
    // 1. Generic help audio: the service's own text, spoken by the provider.
    const help = await timed(() => post('/v1/speech/help', { topic: 'navigation' }));
    if (help.value.status === 200) {
      const parsed = speechHelpResponseSchema.safeParse(await help.value.json());
      const audio = parsed.success ? Buffer.from(parsed.data.audio, 'base64') : Buffer.alloc(0);
      record('generic help audio', parsed.success && audio.subarray(0, 4).toString('latin1') === 'RIFF', help.ms,
        parsed.success ? `${audio.length} bytes of WAV for the navigation text` : 'reply did not match the contract');
    } else {
      record('generic help audio', false, help.ms, `HTTP ${help.value.status} ${await errorCode(help.value)}`);
    }

    // 2. Hindi transcription of an approved recording, or of fictional speech
    //    synthesized through the same adapter when none is supplied.
    let recording: { bytes: Buffer; type: string; source: string };
    const supplied = process.env['FORM_SAATHI_LIVE_AUDIO'];
    if (supplied) {
      recording = { bytes: await readFile(supplied), type: supplied.endsWith('.webm') ? 'audio/webm' : 'audio/wav', source: 'approved recording' };
    } else {
      const synth = await timed(() => new SarvamProvider(readConfig()).synthesize(UNAMBIGUOUS, new AbortController().signal));
      recording = { bytes: Buffer.from(synth.value, 'base64'), type: 'audio/wav', source: `synthesized “${UNAMBIGUOUS}” in ${synth.ms} ms` };
    }
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(recording.bytes)], { type: recording.type }), 'recording.wav');
    const transcribe = await timed(() => fetch(`${origin}/v1/speech/transcribe`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
    }));
    if (transcribe.value.status === 200) {
      const parsed = transcribeResponseSchema.safeParse(await transcribe.value.json());
      record('Hindi transcription', parsed.success && parsed.data.transcript.trim() !== '', transcribe.ms, parsed.success
        ? `${recording.source}; transcript “${parsed.data.transcript}” (${parsed.data.languageCode ?? 'no language code'}); requiresConfirmation=${String(parsed.data.requiresConfirmation)}`
        : 'reply did not match the contract');
    } else {
      record('Hindi transcription', false, transcribe.ms, `HTTP ${transcribe.value.status} ${await errorCode(transcribe.value)}`);
    }

    // 3. An unambiguous spoken date becomes a suggestion the local rules still check.
    const clear = await timed(() => post('/v1/values/interpret', { transcript: UNAMBIGUOUS, field: DOB_FIELD }));
    if (clear.value.status === 200) {
      const parsed = valueInterpretResponseSchema.safeParse(await clear.value.json());
      const suggestion = parsed.success && parsed.data.interpretation.outcome === 'suggestion' ? parsed.data.interpretation.value : null;
      record('unambiguous date interpretation', suggestion !== null, clear.ms, suggestion === null
        ? `outcome ${parsed.success ? parsed.data.interpretation.outcome : 'invalid'}: ${parsed.success ? parsed.data.interpretation.explanation : ''}`
        : `“${UNAMBIGUOUS}” → “${suggestion}”; ${localCheck(suggestion)}; requiresConfirmation=${String(parsed.success && parsed.data.requiresConfirmation)}`);
    } else {
      record('unambiguous date interpretation', false, clear.ms, `HTTP ${clear.value.status} ${await errorCode(clear.value)}`);
    }

    // 4. Ambiguous speech must come back as a request for clarification, never a guess.
    const vague = await timed(() => post('/v1/values/interpret', { transcript: AMBIGUOUS, field: DOB_FIELD }));
    if (vague.value.status === 200) {
      const parsed = valueInterpretResponseSchema.safeParse(await vague.value.json());
      const outcome = parsed.success ? parsed.data.interpretation.outcome : 'invalid';
      record('ambiguous speech → clarification', outcome === 'unknown', vague.ms,
        `“${AMBIGUOUS}” → ${outcome}${parsed.success && parsed.data.interpretation.outcome === 'suggestion' ? ` “${parsed.data.interpretation.value}” (a guessed year is a defect)` : ''}`);
    } else {
      record('ambiguous speech → clarification', false, vague.ms, `HTTP ${vague.value.status} ${await errorCode(vague.value)}`);
    }

    // 5. Field explanation from the minimal, value-free context the panel sends.
    const meaning = await timed(() => post('/v1/fields/interpret', { field: DOB_FIELD }));
    if (meaning.value.status === 200) {
      const parsed = fieldInterpretResponseSchema.safeParse(await meaning.value.json());
      record('field explanation', parsed.success, meaning.ms, parsed.success
        ? `${parsed.data.interpretation.outcome}${parsed.data.interpretation.outcome === 'suggestion' ? ` kind=${parsed.data.interpretation.kind}` : ''}, explanation ${parsed.data.interpretation.explanation.length} chars`
        : 'reply did not match the contract');
    } else {
      record('field explanation', false, meaning.ms, `HTTP ${meaning.value.status} ${await errorCode(meaning.value)}`);
    }

    // 6. Client cancellation after the body was sent, then a healthy service.
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const cancelled = await timed(() => post('/v1/fields/interpret', { field: DOB_FIELD }, token, controller.signal)
      .then(() => 'answered before the abort', (error: Error) => error.name));
    const health = await fetch(`${origin}/health`);
    record('client cancellation', cancelled.value === 'AbortError' && health.status === 200, cancelled.ms,
      `${cancelled.value}; /health ${health.status} afterwards. Upstream abort is verified against the controlled provider in tests/api.ai.integration.test.ts, not observable here.`);

    // 7. Usable failure and recovery: bounded errors, then a normal reply.
    const unauthorized = await post('/v1/fields/interpret', { field: DOB_FIELD }, 'fs1.not-a-valid-credential');
    const oversized = await post('/v1/values/interpret', { transcript: 'क'.repeat(1001), field: DOB_FIELD });
    const again = await timed(() => post('/v1/values/interpret', { transcript: AMBIGUOUS, field: DOB_FIELD }));
    record('failure recovery', unauthorized.status === 401 && oversized.status === 400 && again.value.status === 200, again.ms,
      `invalid credential → ${unauthorized.status} ${await errorCode(unauthorized)}; oversized transcript → ${oversized.status} ${await errorCode(oversized)}; next request → ${again.value.status}`);
  } finally {
    await app.close();
  }

  console.log(`| Case | Result | Latency | Observation |\n| --- | --- | --- | --- |`);
  for (const result of results) {
    console.log(`| ${result.name} | ${result.ok ? 'pass' : 'FAIL'} | ${result.ms} ms | ${result.note.replace(/\|/g, '\\|')} |`);
  }
  console.log(`\n${results.filter((result) => result.ok).length}/${results.length} live cases passed against ${readConfig().providerBaseUrl}. Models: ${readConfig().transcribeModel}, ${readConfig().interpretModel}, ${readConfig().speechModel}.`);
  return results.every((result) => result.ok) ? 0 : 1;
}

process.exitCode = await main();
