import { describe, expect, it } from 'vitest';
import { panelInboxSchema, readerReplySchema, readerRequestSchema } from './messages.js';

const field = {
  fieldId: 'f1',
  key: 'nsp-district',
  kind: 'select',
  label: 'जिला (अभ्यास में आवश्यक)',
  description: '',
  group: '2. पते का सीमित अभ्यास',
  lang: 'hi',
  status: 'read',
  required: true,
  readOnly: false,
  value: '',
  options: [{ value: '', label: 'जिला चुनें', selected: true }],
  constraints: { control: 'select', pattern: null, inputMode: null, maxLength: null, min: null, max: null },
};

const snapshot = {
  tabId: 7,
  documentId: 'doc-1',
  sequence: 0,
  origin: 'http://127.0.0.1:4173',
  title: 'NSP सामान्य जानकारी — केवल अभ्यास',
  fields: [field],
  gaps: [{ reason: 'frame', label: 'असमर्थित स्थानीय अभ्यास फ़्रेम' }],
};

describe('reader message contracts', () => {
  it('accepts a snapshot reply and an inactive conditional field without a value', () => {
    const reply = readerReplySchema.parse({ type: 'snapshot', snapshot });
    expect(reply).toEqual({ type: 'snapshot', snapshot });
    const inactive = { ...snapshot, fields: [{ ...field, status: 'inactive', value: null }] };
    expect(readerReplySchema.safeParse({ type: 'snapshot', snapshot: inactive }).success).toBe(true);
  });

  it('keeps the tab and document context needed to reject stale replies', () => {
    for (const missing of ['tabId', 'documentId', 'sequence']) {
      const { [missing]: _removed, ...rest } = snapshot as Record<string, unknown>;
      expect(readerReplySchema.safeParse({ type: 'snapshot', snapshot: rest }).success).toBe(false);
    }
    expect(readerRequestSchema.safeParse({ type: 'focus', tabId: 7, fieldId: 'f1' }).success).toBe(false);
    expect(readerRequestSchema.safeParse({ type: 'focus', tabId: 7, documentId: 'doc-1', fieldId: 'f1' }).success)
      .toBe(true);
  });

  it('rejects unknown message types, unknown properties, and page-supplied extras', () => {
    for (const message of [
      null,
      { type: 'evaluate', code: 'x' },
      { type: 'snapshot', snapshot: { ...snapshot, password: 'x' } },
      { type: 'snapshot', snapshot: { ...snapshot, fields: [{ ...field, secret: 'x' }] } },
      { type: 'snapshot', snapshot: { ...snapshot, fields: [{ ...field, kind: 'password' }] } },
      { type: 'snapshot', snapshot: { ...snapshot, tabId: '7' } },
    ]) {
      expect(readerReplySchema.safeParse(message).success).toBe(false);
    }
    expect(readerRequestSchema.safeParse({ type: 'scan' }).success).toBe(false);
  });

  it('separates activation notices from snapshots in the panel inbox', () => {
    expect(panelInboxSchema.safeParse({ type: 'activated', tabId: 7 }).success).toBe(true);
    expect(panelInboxSchema.safeParse({ type: 'focus-result', documentId: 'doc-1', fieldId: 'f1', result: 'focused' }).success)
      .toBe(false);
  });
});
