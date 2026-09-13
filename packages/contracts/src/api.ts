import { z } from 'zod';

// Contracts for the optional AI service. Everything crossing this boundary is
// bounded: page text is untrusted input, and a model's reply is untrusted
// output. A reply is a suggestion to be confirmed, never an instruction, a
// selector, a browser action or a validation rule.

// Cloud support is deliberately narrower than interface localization.
export const cloudLocaleSchema = z.enum(['en', 'hi']).default('en');
export const transcribeRequestSchema = z.strictObject({ locale: cloudLocaleSchema });

/**
 * A display vocabulary for explaining a field to a person. It is deliberately
 * separate from the rule packs' field meanings, so a model can never select a
 * validation rule.
 */
export const interpretedKindSchema = z.enum([
  'name', 'date', 'address', 'place', 'identifier', 'contact', 'choice', 'document', 'amount', 'other',
]);

/** A single-line value with no markup, braces or control characters. */
const plainValue = z.string().trim().min(1).max(200).regex(/^[^\p{Cc}<>{}\\]+$/u);
const explanation = z.string().trim().min(1).max(400);

export const fieldContextSchema = z.strictObject({
  label: z.string().max(300),
  description: z.string().max(1000),
  group: z.string().max(300),
  control: z.string().max(40),
  required: z.boolean(),
  pattern: z.string().max(200).nullable(),
  /** Option labels only, so a choice can be explained without inventing one. */
  options: z.array(z.string().max(200)).max(40),
});

export const fieldInterpretRequestSchema = z.strictObject({
  locale: cloudLocaleSchema,
  field: fieldContextSchema,
});

export const fieldInterpretationSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('suggestion'),
    kind: interpretedKindSchema,
    explanation,
    example: z.string().trim().max(120).nullable(),
  }),
  z.strictObject({ outcome: z.literal('unknown'), explanation }),
]);

export const fieldInterpretResponseSchema = z.strictObject({
  interpretation: fieldInterpretationSchema,
  /** Set by the service, never by the model: a suggestion is not a decision. */
  requiresConfirmation: z.literal(true),
});

export const valueInterpretRequestSchema = z.strictObject({
  /** What the person said, after they approved sending it. */
  transcript: z.string().trim().min(1).max(1000),
  locale: cloudLocaleSchema,
  field: fieldContextSchema,
});

export const valueInterpretationSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('suggestion'),
    value: plainValue,
    explanation,
  }),
  z.strictObject({ outcome: z.literal('unknown'), explanation }),
]);

export const valueInterpretResponseSchema = z.strictObject({
  interpretation: valueInterpretationSchema,
  requiresConfirmation: z.literal(true),
});

export const transcribeResponseSchema = z.strictObject({
  transcript: z.string().max(2000),
  languageCode: z.string().max(20).nullable(),
  requiresConfirmation: z.literal(true),
});

/** Generic help only: the audio never carries form values or page text. */
export const helpTopicSchema = z.enum(['navigation', 'review', 'speech-consent', 'privacy']);

export const speechHelpRequestSchema = z.strictObject({ topic: helpTopicSchema, locale: cloudLocaleSchema });

export const speechHelpResponseSchema = z.strictObject({
  topic: helpTopicSchema,
  text: z.string().min(1).max(2000),
  contentType: z.literal('audio/wav'),
  /** Base64 audio, decoded by the panel and played only on request. */
  audio: z.string().min(1).max(4_000_000),
});

/** Every failure the service reports. No provider text or key ever appears. */
export const apiErrorSchema = z.strictObject({
  error: z.enum([
    'invalid_request',
    'unauthorized',
    'rate_limited',
    'payload_too_large',
    'unsupported_media',
    'provider_unavailable',
    'provider_response_invalid',
    'service_not_configured',
    'cancelled',
    'not_found',
    'internal',
  ]),
  message: z.string().max(300),
  /** Field paths that failed validation, never their values. */
  fields: z.array(z.string().max(120)).max(20),
});

export type InterpretedKind = z.infer<typeof interpretedKindSchema>;
export type FieldContext = z.infer<typeof fieldContextSchema>;
export type FieldInterpretRequest = z.infer<typeof fieldInterpretRequestSchema>;
export type FieldInterpretResponse = z.infer<typeof fieldInterpretResponseSchema>;
export type ValueInterpretRequest = z.infer<typeof valueInterpretRequestSchema>;
export type ValueInterpretResponse = z.infer<typeof valueInterpretResponseSchema>;
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
export type HelpTopic = z.infer<typeof helpTopicSchema>;
export type SpeechHelpRequest = z.infer<typeof speechHelpRequestSchema>;
export type SpeechHelpResponse = z.infer<typeof speechHelpResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
