import { describe, expect, it } from 'vitest';
import { acknowledgmentState, reviewRevision, shortRevision, summarizeReview, type ReviewMaterial } from './review.js';
import type { ValidationResult } from './validate.js';

const material: ReviewMaterial = {
  documentId: 'doc-1',
  pack: { id: 'nsp-2026-27-basic-general', version: '1.0', reviewed: '2026-09-12' },
  reference: 'KAVYA SAIN',
  fields: [
    { key: 'nsp-dob', label: 'जन्म तारीख', group: '1', kind: 'text', status: 'read', required: false, readOnly: true, value: '15/08/2004', options: [] },
    { key: 'nsp-district', label: 'जिला', group: '2', kind: 'select', status: 'read', required: true, readOnly: false, value: 'lucknow', options: [{ value: 'lucknow', selected: true }, { value: 'kanpur', selected: false }] },
  ],
  gaps: [{ reason: 'frame', label: 'अभ्यास फ़्रेम' }],
};

function result(ruleId: string, severity: ValidationResult['severity'], fieldId: string | null = null): ValidationResult {
  return { ruleId, fieldId, severity, message: `${ruleId} message`, action: 'act', source: null };
}

describe('review revision', () => {
  it('is identical for identical data and differs for every relevant change', () => {
    const base = reviewRevision(material);
    expect(reviewRevision(structuredClone(material))).toBe(base);
    const changes: ReviewMaterial[] = [
      { ...material, documentId: 'doc-2' },
      { ...material, reference: 'KAVYA SAI' },
      { ...material, pack: { ...material.pack!, version: '1.1' } },
      { ...material, pack: null },
      { ...material, gaps: [] },
      { ...material, fields: material.fields.map((field) => (field.key === 'nsp-district' ? { ...field, value: '' } : field)) },
      { ...material, fields: material.fields.map((field) => (field.key === 'nsp-district' ? { ...field, status: 'inactive' } : field)) },
      { ...material, fields: material.fields.map((field) => (field.key === 'nsp-district' ? { ...field, required: false } : field)) },
      { ...material, fields: material.fields.map((field) => (field.key === 'nsp-district' ? { ...field, label: 'ज़िला' } : field)) },
      { ...material, fields: material.fields.slice(1) },
      { ...material, fields: [...material.fields, { ...material.fields[0]!, key: 'nsp-note', value: '' }] },
    ];
    const revisions = new Set(changes.map(reviewRevision));
    expect(revisions.has(base)).toBe(false);
    expect(revisions.size).toBe(changes.length);
    expect(shortRevision(base)).toMatch(/^[0-9a-f]{8}$/);
    expect(shortRevision(base)).not.toBe(shortRevision(reviewRevision(changes[0]!)));
  });
});

describe('review summary', () => {
  const fields = [{ fieldId: 'f-dob', readOnly: true }, { fieldId: 'f-district', readOnly: false }];

  it('never reports clear while anything that could be checked was not', () => {
    const summary = summarizeReview([result('live-testing-unverified', 'unchecked'), result('coverage-gap', 'unchecked')], fields, [{ reason: 'frame', label: 'फ़्रेम' }]);
    expect(summary.outcome).toBe('partial-coverage');
    expect(summary.permanentLimits).toBe(1);
  });

  it('reports clear only when nothing is open beyond the permanent limits', () => {
    const summary = summarizeReview([result('live-testing-unverified', 'unchecked'), result('pin-district-unchecked', 'unchecked')], fields, []);
    expect(summary).toEqual({ outcome: 'clear', errors: 0, confirmations: 0, unchecked: 2, blockers: [], permanentLimits: 2 });
  });

  it('ranks blockers, then corrections, then confirmations', () => {
    expect(summarizeReview([result('required-value', 'error', 'f-district'), result('name-reference', 'needs-confirmation', 'f-dob')], fields, []).outcome)
      .toBe('corrections-pending');
    expect(summarizeReview([result('name-reference', 'needs-confirmation', 'f-dob')], fields, []).outcome).toBe('confirmation-needed');
    const blocked = summarizeReview([result('date-calendar', 'error', 'f-dob')], fields, [{ reason: 'sensitive', label: 'कैप्चा' }]);
    expect(blocked.outcome).toBe('blocked');
    expect(blocked.blockers).toEqual(['कैप्चा', 'date-calendar message']);
  });
});

describe('acknowledgment state', () => {
  const shown = { documentId: 'doc-1', revision: reviewRevision(material) };

  it('moves from none to current to stale as the reviewed data changes', () => {
    expect(acknowledgmentState(null, shown)).toBe('none');
    expect(acknowledgmentState(shown, shown)).toBe('current');
    const edited = { ...shown, revision: reviewRevision({ ...material, reference: 'KAVYA SAI' }) };
    expect(acknowledgmentState(shown, edited)).toBe('stale');
  });

  it('never carries over to another document or to no document', () => {
    expect(acknowledgmentState(shown, { ...shown, documentId: 'doc-2' })).toBe('none');
    expect(acknowledgmentState(shown, null)).toBe('none');
  });
});
