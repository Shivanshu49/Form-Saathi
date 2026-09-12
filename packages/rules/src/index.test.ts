import { describe, expect, it } from 'vitest';
import { eciPack, maskIdentifier, nspPack, recognizePage, selectRulePack, speechEligibility } from './index.js';

describe('page recognition', () => {
  it('recognizes the two portal hosts and their subdomains', () => {
    expect(recognizePage('https://scholarships.gov.in')).toEqual({ kind: 'portal', workflow: 'nsp' });
    expect(recognizePage('https://www.scholarships.gov.in')).toEqual({ kind: 'portal', workflow: 'nsp' });
    expect(recognizePage('https://voters.eci.gov.in')).toEqual({ kind: 'portal', workflow: 'eciForm6' });
  });

  it('treats loopback as a local page and anything else as unknown', () => {
    expect(recognizePage('http://127.0.0.1:4173')).toEqual({ kind: 'local' });
    expect(recognizePage('http://localhost:3000')).toEqual({ kind: 'local' });
    for (const origin of ['https://example.com', 'https://scholarships.gov.in.example.com', 'null', '']) {
      expect(recognizePage(origin)).toEqual({ kind: 'unknown' });
    }
  });
});

describe('rule pack selection', () => {
  const nspKeys = nspPack.fields.map((rule) => rule.key);
  const eciKeys = eciPack.fields.map((rule) => rule.key);

  it('selects a pack only for a page carrying its workflow signature', () => {
    expect(selectRulePack('http://127.0.0.1:4173', nspKeys)).toMatchObject({ pack: nspPack, via: 'practice', missing: [] });
    expect(selectRulePack('https://voters.eci.gov.in', eciKeys)).toMatchObject({ pack: eciPack, via: 'host', missing: [] });
    // The signature alone selects; optional fields such as the practice note may be absent.
    expect(selectRulePack('http://127.0.0.1:4173', ['eci-name-hi', 'eci-age-proof'])).toMatchObject({ pack: eciPack, via: 'practice' });
  });

  it('never lets a hostname alone establish a workflow', () => {
    expect(selectRulePack('https://voters.eci.gov.in', [])).toEqual({ pack: null, reason: 'no-fields' });
    expect(selectRulePack('https://voters.eci.gov.in', ['search', 'epic'])).toEqual({ pack: null, reason: 'no-workflow' });
    expect(selectRulePack('https://scholarships.gov.in', ['nsp-otr'])).toEqual({ pack: null, reason: 'no-workflow' });
    // Another workflow's fields on this portal do not select that workflow's pack.
    expect(selectRulePack('https://scholarships.gov.in', eciKeys)).toEqual({ pack: null, reason: 'no-workflow' });
    expect(selectRulePack('https://example.com', nspKeys)).toEqual({ pack: null, reason: 'unknown-page' });
    expect(selectRulePack('http://127.0.0.1:4173', ['postal-pin'])).toEqual({ pack: null, reason: 'unknown-page' });
  });

  it('lists the non-optional fields a matched page does not offer', () => {
    const selection = selectRulePack('http://127.0.0.1:4173', ['nsp-otr', 'nsp-locality', 'nsp-note']);
    expect(selection.pack).toBe(nspPack);
    if (selection.pack === null) return;
    expect(selection.missing.map((rule) => rule.key)).toEqual(
      nspKeys.filter((key) => !['nsp-otr', 'nsp-locality', 'nsp-note', 'nsp-detail'].includes(key)),
    );
  });
});

describe('identifier masking', () => {
  it('masks long digit strings down to their last four characters', () => {
    expect(maskIdentifier('90000000000001')).toEqual({ masked: true, text: '••••••••••0001' });
    expect(maskIdentifier('1234 5678 9012')).toEqual({ masked: true, text: '••••••••9012' });
  });

  it('leaves dates, postal codes, names and empty values readable', () => {
    for (const value of ['31/02/2004', '226001', 'KAVYA SAIN', 'अभ्यास क्षेत्र एक', '']) {
      expect(maskIdentifier(value)).toEqual({ masked: false, text: value });
    }
  });
});

describe('speech eligibility', () => {
  const base = { status: 'read', readOnly: false, value: '' };

  it('allows an editable field with an ordinary value', () => {
    expect(speechEligibility({ ...base, key: 'nsp-address', value: '12, पथ' }, nspPack)).toEqual({ allowed: true });
    expect(speechEligibility({ ...base, key: 'eci-dob', value: '' }, null)).toEqual({ allowed: true });
  });

  it('refuses identifiers by reviewed meaning, even when empty', () => {
    expect(speechEligibility({ ...base, key: 'nsp-otr', value: '' }, nspPack))
      .toEqual({ allowed: false, reason: 'identifier' });
  });

  it('refuses anything that looks like an identifier, whatever the pack says', () => {
    expect(speechEligibility({ ...base, key: 'nsp-detail', value: '123456789012' }, nspPack))
      .toEqual({ allowed: false, reason: 'identifier' });
    expect(speechEligibility({ ...base, key: 'unknown', value: '9876 5432 1098' }, null))
      .toEqual({ allowed: false, reason: 'identifier' });
  });

  it('refuses read-only and inactive fields', () => {
    expect(speechEligibility({ ...base, key: 'nsp-name', readOnly: true, value: 'KAVYA' }, nspPack))
      .toEqual({ allowed: false, reason: 'read-only' });
    expect(speechEligibility({ ...base, key: 'nsp-locality-other', status: 'inactive', value: null }, nspPack))
      .toEqual({ allowed: false, reason: 'inactive' });
  });
});
