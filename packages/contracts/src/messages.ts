import { z } from 'zod';

// Contracts for panel <-> content-script messages. Form data stays inside the
// browser: nothing here is ever sent to the API. Both sides validate, because
// field labels and values come from untrusted page content.

/** Why part of the page was not read. Coverage gaps are reported, never hidden. */
export const coverageReasonSchema = z.enum(['frame', 'sensitive', 'unsupported-control']);

export const coverageGapSchema = z.strictObject({
  reason: coverageReasonSchema,
  /** Page-supplied hint (frame title, label, control name). Display as text only. */
  label: z.string(),
});

export const fieldOptionSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
  selected: z.boolean(),
});

export const formFieldSchema = z.strictObject({
  /** Stable while the document lives; not reused across reloads. */
  fieldId: z.string().min(1),
  /**
   * Identifier of the form element that owns the control, stable like
   * `fieldId`, or empty for a control outside any form. Two id-less forms
   * may carry the same control names, so a name never stands in for this.
   */
  form: z.string(),
  /** The control's own name or id. Page-supplied: rule packs match on it. */
  key: z.string(),
  kind: z.enum(['text', 'textarea', 'select', 'radio-group', 'checkbox']),
  label: z.string(),
  /** Instructions the page associates with the field (aria-describedby, title). */
  description: z.string(),
  /** Enclosing fieldset legend, when the page has one. */
  group: z.string(),
  /** The control's effective language tag, so a screen reader can switch voice. */
  lang: z.string(),
  labelLang: z.string().optional(),
  groupLang: z.string().optional(),
  instructions: z.array(z.strictObject({ text: z.string(), lang: z.string() })).optional(),
  /** `inactive` covers hidden or disabled conditional fields; their value is not read. */
  status: z.enum(['read', 'inactive']),
  required: z.boolean(),
  readOnly: z.boolean(),
  value: z.string().nullable(),
  options: z.array(fieldOptionSchema),
  constraints: z.strictObject({
    control: z.string(),
    pattern: z.string().nullable(),
    inputMode: z.string().nullable(),
    maxLength: z.number().int().nullable(),
    min: z.string().nullable(),
    max: z.string().nullable(),
  }),
});

export const formSnapshotSchema = z.strictObject({
  /** Tab the reader was activated for; the panel drops anything else. */
  tabId: z.number().int().nonnegative(),
  /** New for every document instance, so a reloaded page cannot look current. */
  documentId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  origin: z.string(),
  title: z.string(),
  lang: z.string().optional(),
  fields: z.array(formFieldSchema),
  gaps: z.array(coverageGapSchema),
});

const snapshotMessageSchema = z.strictObject({
  type: z.literal('snapshot'),
  snapshot: formSnapshotSchema,
});

const focusResultSchema = z.strictObject({
  type: z.literal('focus-result'),
  documentId: z.string().min(1),
  fieldId: z.string().min(1),
  result: z.enum(['focused', 'missing', 'stale']),
});

/** Panel -> content script. */
export const readerRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('scan'), tabId: z.number().int().nonnegative() }),
  z.strictObject({
    type: z.literal('focus'),
    tabId: z.number().int().nonnegative(),
    documentId: z.string().min(1),
    fieldId: z.string().min(1),
  }),
]);

/** Content script -> panel, as a reply and as an unprompted update. */
export const readerReplySchema = z.discriminatedUnion('type', [snapshotMessageSchema, focusResultSchema]);

/** Everything the panel accepts through runtime messaging. */
export const panelInboxSchema = z.discriminatedUnion('type', [
  snapshotMessageSchema,
  z.strictObject({ type: z.literal('activated'), tabId: z.number().int().nonnegative() }),
]);

export type CoverageGap = z.infer<typeof coverageGapSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormSnapshot = z.infer<typeof formSnapshotSchema>;
export type ReaderRequest = z.infer<typeof readerRequestSchema>;
export type ReaderReply = z.infer<typeof readerReplySchema>;
export type PanelInboxMessage = z.infer<typeof panelInboxSchema>;
