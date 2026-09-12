import { describe, expect, it } from 'vitest';
import type { FormField } from '@form-saathi/contracts';
import { relocate } from '../apps/extension/entrypoints/sidepanel/relocate.js';

// A replaced control gets a new identifier; the panel keeps the person's place
// only when the stand-in is unambiguous, and never by a name alone.

function field(fieldId: string, key: string, extra: Partial<FormField> = {}): FormField {
  return {
    fieldId, key, form: 'form-a', kind: 'text', label: key, description: '', group: '', lang: '', status: 'read',
    required: false, readOnly: false, value: '', options: [],
    constraints: { control: 'text', pattern: null, inputMode: null, maxLength: null, min: null, max: null },
    ...extra,
  };
}

const before = [field('f1', 'name'), field('f2', 'pin'), field('f3', 'district')];

describe('relocating the current field', () => {
  it('audit regression: follows an identical replacement to its new identifier', () => {
    const after = [before[0]!, field('f9', 'pin'), before[2]!];
    expect(relocate(before, 'f2', after)).toEqual({ fieldId: 'f9', reason: null });
  });

  it('audit regression: tells two id-less forms with the same control names apart', () => {
    const twoForms = [field('f1', 'shared', { form: 'form-a' }), field('f2', 'shared', { form: 'form-b' })];
    const after = [field('f1', 'shared', { form: 'form-a' }), field('f7', 'shared', { form: 'form-b' })];
    expect(relocate(twoForms, 'f2', after)).toEqual({ fieldId: 'f7', reason: null });
    // The same name in the other form is never taken for it, whether the
    // control alone or its whole form disappeared.
    const onlyFirst = [field('f1', 'shared', { form: 'form-a' })];
    expect(relocate(twoForms, 'f2', onlyFirst)).toEqual({ fieldId: null, reason: 'removed' });
    const emptiedSecond = [field('f1', 'shared', { form: 'form-a' }), field('f3', 'other', { form: 'form-b' })];
    expect(relocate(twoForms, 'f2', emptiedSecond)).toEqual({ fieldId: null, reason: 'removed' });
  });

  it('audit regression: keeps the place among identical twins by document order, and refuses when their number changed', () => {
    const twins = [field('t1', 'twin'), field('t2', 'twin'), field('t3', 'twin')];
    expect(relocate(twins, 't2', [field('t1', 'twin'), field('t8', 'twin'), field('t3', 'twin')])).toEqual({ fieldId: 't8', reason: null });
    expect(relocate(twins, 't2', [field('t8', 'twin'), field('t3', 'twin')])).toEqual({ fieldId: null, reason: 'ambiguous' });
    expect(relocate(twins, 't2', [field('t1', 'twin'), field('t8', 'twin'), field('t3', 'twin'), field('t4', 'twin')])).toEqual({ fieldId: null, reason: 'ambiguous' });
  });

  it('audit regression: survives a form re-rendered whole, but reports a control that is gone', () => {
    const rerendered = [field('g1', 'name', { form: 'form-z' }), field('g2', 'pin', { form: 'form-z' }), field('g3', 'district', { form: 'form-z' })];
    expect(relocate(before, 'f2', rerendered)).toEqual({ fieldId: 'g2', reason: null });
    expect(relocate(before, 'f2', [before[0]!, before[2]!])).toEqual({ fieldId: null, reason: 'removed' });
    expect(relocate(before, 'unknown', before)).toEqual({ fieldId: null, reason: 'removed' });
    // A different label, kind or section is a different control, not a stand-in.
    expect(relocate(before, 'f2', [before[0]!, field('f9', 'pin', { label: 'PIN (बदला)' }), before[2]!]).reason).toBe('removed');
  });
});
