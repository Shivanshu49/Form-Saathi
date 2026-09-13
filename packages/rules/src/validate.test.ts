import { describe, expect, it } from 'vitest';
import { eciPack, nspPack, type RulePack } from './packs.js';
import { summarizeReview } from './review.js';
import {
  calendarProblem,
  formatDate,
  localToday,
  normalizeDigits,
  validateSnapshot,
  validateWithPack,
  type ValidationField,
  type ValidationInput,
  type ValidationResult,
} from './validate.js';

// Fixtures are written here from fixtures/expected-results.md and the published
// field inventory, never generated from the engine's own output.

const PRACTICE = 'http://127.0.0.1:4173';

function field(key: string, value: string | null, extra: Partial<ValidationField> = {}): ValidationField {
  return {
    fieldId: `id-${key}`,
    key,
    label: key,
    kind: 'text',
    status: 'read',
    required: false,
    value,
    options: [],
    ...extra,
  };
}

function choice(key: string, selected: string, extra: Partial<ValidationField> = {}): ValidationField {
  return field(key, selected, { kind: 'radio-group', options: [{ value: selected, label: selected, selected: true }], ...extra });
}

/** NSP profile A, “सुधार का अभ्यास”: five seeded tasks. */
function nspIssues(): ValidationField[] {
  return [
    field('nsp-name', 'KAVYA SAI'),
    field('nsp-dob', '31/02/2004'),
    field('nsp-gender', 'महिला'),
    field('nsp-state', 'उत्तर प्रदेश'),
    field('nsp-district', '', { kind: 'select', options: [{ value: '', label: 'जिला चुनें', selected: true }] }),
    field('nsp-address', '12, काल्पनिक अभ्यास पथ'),
    field('nsp-pin', '226001'),
    choice('nsp-locality', 'other'),
    field('nsp-locality-other', ''),
    field('nsp-otr', '9000000000001'),
    field('nsp-detail', '123456789012'),
  ];
}

/** NSP profile A, “भरे हुए उदाहरण”: nothing should be reported as wrong. */
function nspComplete(): ValidationField[] {
  return [
    field('nsp-name', 'KAVYA SAIN'),
    field('nsp-dob', '15/08/2004'),
    field('nsp-gender', 'महिला'),
    field('nsp-state', 'उत्तर प्रदेश'),
    field('nsp-district', 'lucknow', { kind: 'select', options: [{ value: 'lucknow', label: 'लखनऊ', selected: true }] }),
    field('nsp-address', '12, काल्पनिक अभ्यास पथ'),
    field('nsp-pin', '226001'),
    choice('nsp-locality', 'other'),
    field('nsp-locality-other', 'अभ्यास क्षेत्र एक'),
    field('nsp-otr', '90000000000001'),
    field('nsp-detail', '123456789012'),
  ];
}

function eciIssues(): ValidationField[] {
  return [
    field('eci-name-hi', 'अरुण देव'),
    field('eci-name-en', 'ARUN DE'),
    choice('eci-gender', 'male'),
    field('eci-dob', '31/02/2000'),
    choice('eci-age-proof', 'other'),
    field('eci-age-proof-other', ''),
    field('eci-address', '36, काल्पनिक अभ्यास गली'),
    field('eci-district', ''),
    field('eci-state', 'उत्तर प्रदेश'),
    field('eci-pin', '22601'),
    field('eci-email', ''),
    field('eci-detail', '345678901234'),
  ];
}

function run(fields: ValidationField[], englishName = '', gaps: ValidationInput['gaps'] = []): ValidationResult[] {
  return validateSnapshot({ origin: PRACTICE, fields, gaps, reference: { englishName } });
}

function bySeverity(results: ValidationResult[], severity: ValidationResult['severity']): ValidationResult[] {
  return results.filter((result) => result.severity === severity);
}

describe('seeded practice problems', () => {
  it('finds exactly the four NSP corrections and one name confirmation', () => {
    const results = run(nspIssues(), 'KAVYA SAIN');
    expect(bySeverity(results, 'error').map((result) => [result.ruleId, result.fieldId])).toEqual([
      ['date-calendar', 'id-nsp-dob'],
      ['required-value', 'id-nsp-district'],
      ['required-value', 'id-nsp-locality-other'],
      ['otr-format', 'id-nsp-otr'],
    ]);
    const confirmations = bySeverity(results, 'needs-confirmation');
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]?.ruleId).toBe('name-reference');
    expect(confirmations[0]?.message).toContain('KAVYA SAI');
    expect(confirmations[0]?.message).toContain('KAVYA SAIN');
  });

  it('finds exactly the four ECI corrections and one name confirmation', () => {
    const results = run(eciIssues(), 'ARUN DEV');
    expect(bySeverity(results, 'error').map((result) => result.ruleId)).toEqual([
      'date-calendar',
      'required-value',
      'required-value',
      'pin-format',
    ]);
    expect(bySeverity(results, 'needs-confirmation').map((result) => result.fieldId)).toEqual(['id-eci-name-en']);
  });

  it('explains each result with a stable rule, Hindi text and a next action', () => {
    for (const result of run(nspIssues(), 'KAVYA SAIN')) {
      expect(result.ruleId).toMatch(/^[a-z-]+$/);
      expect(result.message.length).toBeGreaterThan(10);
      expect(result.action.length).toBeGreaterThan(5);
      expect(['error', 'needs-confirmation', 'unchecked']).toContain(result.severity);
    }
  });
});

describe('filled practice profiles', () => {
  it('reports no correction and no confirmation for NSP', () => {
    const results = run(nspComplete(), 'KAVYA SAIN');
    expect(bySeverity(results, 'error')).toEqual([]);
    expect(bySeverity(results, 'needs-confirmation')).toEqual([]);
    expect(bySeverity(results, 'unchecked').length).toBeGreaterThan(0);
  });

  it('reports no correction for ECI, including an empty optional email', () => {
    const fields = eciIssues().map((current) => {
      const replacements: Record<string, string> = {
        'eci-name-en': 'ARUN DEV', 'eci-dob': '15/08/2000',
        'eci-age-proof-other': 'काल्पनिक आयु अभिलेख एक', 'eci-district': 'लखनऊ', 'eci-pin': '226001',
      };
      const value = replacements[current.key];
      return value === undefined ? current : { ...current, value };
    });
    const results = run(fields, 'ARUN DEV');
    expect(bySeverity(results, 'error')).toEqual([]);
    expect(bySeverity(results, 'needs-confirmation')).toEqual([]);
    expect(results.some((result) => result.fieldId === 'id-eci-email')).toBe(false);
  });
});

describe('conditional controls', () => {
  it('does not require the other-locality detail once another choice is made', () => {
    const fields = nspIssues().map((current) => (
      current.key === 'nsp-locality' ? choice('nsp-locality', 'urban') : current
    ));
    expect(run(fields).some((result) => result.fieldId === 'id-nsp-locality-other' && result.severity === 'error'))
      .toBe(false);
  });

  it('ignores a hidden or disabled control entirely', () => {
    const fields = nspIssues().map((current) => (
      current.key === 'nsp-locality-other' ? { ...current, status: 'inactive' as const, value: null } : current
    ));
    expect(run(fields).some((result) => result.fieldId === 'id-nsp-locality-other')).toBe(false);
  });

  it('says so when the controlling field cannot be read instead of guessing', () => {
    const fields = nspIssues().map((current) => (
      current.key === 'nsp-locality' ? { ...current, status: 'inactive' as const, value: null } : current
    ));
    const result = run(fields).find((current) => current.fieldId === 'id-nsp-locality-other');
    expect(result?.severity).toBe('unchecked');
    expect(result?.ruleId).toBe('conditional-unknown');
  });
});

describe('calendar dates', () => {
  it('accepts real dates, including leap days', () => {
    for (const value of ['15/08/2004', '29/02/2024', '29/02/2000', '01/01/1999', '31/12/2020', '१५/०८/२०००']) {
      expect(calendarProblem(value)).toBeNull();
    }
  });

  it('rejects impossible dates', () => {
    expect(calendarProblem('31/02/2004')).toEqual({ kind: 'day', month: 2, year: 2004, days: 29 });
    expect(calendarProblem('29/02/2023')).toEqual({ kind: 'day', month: 2, year: 2023, days: 28 });
    expect(calendarProblem('29/02/1900')).toEqual({ kind: 'day', month: 2, year: 1900, days: 28 });
    expect(calendarProblem('31/04/2020')).toEqual({ kind: 'day', month: 4, year: 2020, days: 30 });
    expect(calendarProblem('15/13/2020')).toEqual({ kind: 'month' });
    for (const value of ['15-08-2004', '2004/08/15', '15 अगस्त 2004', '15/08/04', '']) {
      expect(calendarProblem(value)?.kind).toBe(value === '15-08-2004' ? undefined : 'format');
    }
  });
});

describe('Devanagari digits', () => {
  it('maps each digit one to one and interprets no number words', () => {
    expect(normalizeDigits('१५/०८/२०००')).toBe('15/08/2000');
    expect(normalizeDigits('२२६००१')).toBe('226001');
    // Words are never parsed: "दो सौ" and "सौ दो" would be ambiguous to add up.
    expect(normalizeDigits('दो सौ')).toBe('दो सौ');
  });

  it('accepts a Devanagari PIN but says the portal may not', () => {
    const fields = nspComplete().map((current) => (
      current.key === 'nsp-pin' ? { ...current, value: '२२६००१' } : current
    ));
    const results = run(fields, 'KAVYA SAIN');
    expect(bySeverity(results, 'error')).toEqual([]);
    expect(results.find((result) => result.ruleId === 'devanagari-digits')?.severity).toBe('unchecked');
  });
});

describe('identifiers selected by a reviewed meaning', () => {
  const bankPack: RulePack = {
    ...nspPack,
    id: 'test-bank-pack',
    signature: ['bank-ifsc'],
    fields: [
      { key: 'bank-ifsc', meaning: 'ifsc', requirement: 'required', source: 'B1' },
      { key: 'person-aadhaar', meaning: 'aadhaar', requirement: 'optional', source: 'U1' },
      { key: 'person-eid', meaning: 'aadhaar-eid', requirement: 'optional', source: 'U1' },
    ],
  };

  function bank(values: Record<string, string>): ValidationResult[] {
    return validateWithPack(bankPack, 'practice', {
      origin: PRACTICE,
      fields: Object.entries(values).map(([key, value]) => field(key, value)),
      gaps: [],
      reference: { englishName: '' },
    });
  }

  it('accepts a well-formed IFSC and rejects malformed ones', () => {
    expect(bySeverity(bank({ 'bank-ifsc': 'SBIN0001234' }), 'error')).toEqual([]);
    expect(bySeverity(bank({ 'bank-ifsc': 'sbin0001234' }), 'error')).toEqual([]);
    for (const value of ['SBI0001234', 'SBIN1001234', 'SBIN000123', 'SBIN0001234X', '12345678901']) {
      expect(bySeverity(bank({ 'bank-ifsc': value }), 'error').map((result) => result.ruleId)).toEqual(['ifsc-format']);
    }
  });

  it('never claims the branch or account behind an IFSC exists', () => {
    const results = bank({ 'bank-ifsc': 'SBIN0001234' });
    expect(results.find((result) => result.ruleId === 'ifsc-branch-unchecked')?.severity).toBe('unchecked');
  });

  it('leaves Aadhaar and EID unchecked while no verified specification is on file', () => {
    const results = bank({ 'person-aadhaar': '123456789012', 'person-eid': '1234/12345/123456' });
    expect(bySeverity(results, 'error')).toEqual([]);
    expect(results.filter((result) => result.ruleId.startsWith('aadhaar')).map((result) => result.severity))
      .toEqual(['unchecked', 'unchecked']);
  });

  it('keeps the OTR rule to OTR fields and never treats other numbers as identifiers', () => {
    const otr = run(nspIssues(), '').find((result) => result.ruleId === 'otr-format');
    expect(otr?.source).toBe('N1');
    expect(otr?.message).toContain('not Aadhaar');
    // The same 12-digit shape in an unclear field is reported as unknown, not classified.
    const unclear = run(nspComplete(), 'KAVYA SAIN').find((result) => result.fieldId === 'id-nsp-detail');
    expect(unclear?.severity).toBe('unchecked');
    expect(unclear?.ruleId).toBe('unknown-meaning');
  });
});

describe('name comparison against a supplied reference', () => {
  it('asks for confirmation instead of reporting an error', () => {
    const results = run(nspIssues(), 'KAVYA SAIN').filter((result) => result.ruleId === 'name-reference');
    expect(results.map((result) => result.severity)).toEqual(['needs-confirmation']);
    expect(results[0]?.action).toContain('Speech cannot establish spelling');
  });

  it('stays unchecked when no reference was supplied', () => {
    const results = run(nspIssues(), '').filter((result) => result.ruleId === 'name-reference');
    expect(results.map((result) => result.severity)).toEqual(['unchecked']);
  });

  it('treats a case difference as something to confirm, not to correct', () => {
    const results = run(nspComplete(), 'Kavya Sain').filter((result) => result.ruleId === 'name-reference');
    expect(results.map((result) => result.severity)).toEqual(['needs-confirmation']);
  });

  it('does not report a missing English name on Form 6, and stops comparing', () => {
    const fields = eciIssues().map((current) => (current.key === 'eci-name-en' ? { ...current, value: '' } : current));
    const results = run(fields, 'ARUN DEV').filter((result) => result.fieldId === 'id-eci-name-en');
    expect(results.map((result) => result.severity)).toEqual(['unchecked']);
  });
});

describe('what is never checked', () => {
  it('leaves PIN and district agreement unchecked, with no directory of its own', () => {
    const result = run(nspComplete(), 'KAVYA SAIN').find((current) => current.ruleId === 'pin-district-unchecked');
    expect(result?.severity).toBe('unchecked');
    expect(result?.source).toBeNull();
  });

  it('reports coverage gaps and unmapped fields as unchecked', () => {
    const fields = [...nspComplete(), field('mystery-field', 'कुछ')];
    const results = run(fields, 'KAVYA SAIN', [{ reason: 'frame', label: 'अभ्यास फ़्रेम' }]);
    expect(results.find((result) => result.ruleId === 'unmapped-fields')?.message).toContain('1 fields');
    expect(results.find((result) => result.ruleId === 'coverage-gap')?.severity).toBe('unchecked');
  });

  it('still reports a page-required empty field that the pack does not map', () => {
    const fields = [...nspComplete(), field('mystery-field', '', { required: true })];
    const errors = bySeverity(run(fields, 'KAVYA SAIN'), 'error');
    expect(errors.map((result) => result.fieldId)).toEqual(['id-mystery-field']);
    expect(errors[0]?.source).toBe('page-required');
  });

  it('validates nothing at all on a page no pack describes', () => {
    const results = validateSnapshot({
      origin: 'https://example.com',
      fields: nspIssues(),
      gaps: [],
      reference: { englishName: 'KAVYA SAIN' },
    });
    expect(results.map((result) => result.ruleId)).toEqual(['no-rule-pack']);
  });

  it('never reviews an empty or unrelated portal page as a workflow', () => {
    const empty = validateSnapshot({ origin: 'https://voters.eci.gov.in', fields: [], gaps: [], reference: { englishName: '' } });
    expect(empty.map((result) => result.ruleId).sort()).toEqual(['no-readable-fields', 'no-rule-pack']);
    expect(empty.find((result) => result.ruleId === 'no-rule-pack')?.message).toContain('No readable fields');
    expect(summarizeReview(empty, [], []).outcome).toBe('partial-coverage');

    for (const origin of ['https://voters.eci.gov.in', 'https://scholarships.gov.in']) {
      const unrelated = validateSnapshot({
        origin,
        fields: [field('search', 'लखनऊ'), field('epic-number', '', { required: true })],
        gaps: [],
        reference: { englishName: '' },
      });
      // The host says which portal; only the workflow's own fields say which form.
      expect(unrelated.map((result) => result.ruleId)).toEqual(['no-rule-pack']);
      expect(unrelated[0]?.message).toContain('does not match a reviewed workflow');
      expect(summarizeReview(unrelated, [], []).outcome).not.toBe('clear');
    }

    // Every field hidden: nothing applicable was reviewed either.
    const hidden = run(nspComplete().map((current) => ({ ...current, status: 'inactive' as const, value: null })), 'KAVYA SAIN');
    expect(hidden.some((result) => result.ruleId === 'no-readable-fields')).toBe(true);
    expect(summarizeReview(hidden, [], []).outcome).not.toBe('clear');
  });

  it('applies a pack on its live host only with the workflow signature, and reports missing fields', () => {
    const complete = validateSnapshot({ origin: 'https://scholarships.gov.in', fields: nspComplete(), gaps: [], reference: { englishName: 'KAVYA SAIN' } });
    expect(complete.find((result) => result.ruleId === 'live-testing-unverified')?.message).toContain('unverified');
    expect(complete.some((result) => result.ruleId === 'expected-fields-missing')).toBe(false);
    expect(bySeverity(complete, 'error')).toEqual([]);

    const partial = validateSnapshot({
      origin: 'https://scholarships.gov.in',
      fields: nspComplete().filter((current) => !['nsp-pin', 'nsp-dob', 'nsp-note'].includes(current.key)),
      gaps: [],
      reference: { englishName: 'KAVYA SAIN' },
    });
    const missing = partial.find((result) => result.ruleId === 'expected-fields-missing');
    expect(missing?.severity).toBe('unchecked');
    expect(missing?.message).toContain('2 expected fields');
    expect(missing?.message).toContain('nsp-dob, nsp-pin');
    expect(summarizeReview(partial, [], []).outcome).toBe('partial-coverage');
  });

  it('marks both shipped packs as untested against their live portals', () => {
    for (const pack of [nspPack, eciPack]) {
      expect(pack.liveTesting).toBe('unverified');
      expect(pack.version).toBe('1.0');
      expect(pack.reviewed).toBe('2026-09-12');
    }
    expect(run(nspComplete(), 'KAVYA SAIN').find((result) => result.ruleId === 'live-testing-unverified')?.severity)
      .toBe('unchecked');
  });
});

describe('date of birth scope', () => {
  const today = { year: 2026, month: 9, day: 12 };

  function dob(value: string, extra: Partial<ValidationField> = {}): ValidationResult[] {
    const fields = eciIssues().map((current) => (current.key === 'eci-dob' ? { ...current, value, ...extra } : current));
    return validateSnapshot({ origin: PRACTICE, fields, gaps: [], reference: { englishName: 'ARUN DEV' }, today })
      .filter((result) => result.fieldId === 'id-eci-dob');
  }
  const errors = (results: ValidationResult[]) => bySeverity(results, 'error').map((result) => result.ruleId);

  it('accepts today and rejects tomorrow against an injected clock', () => {
    expect(errors(dob('12/09/2026'))).toEqual([]);
    expect(errors(dob('13/09/2026'))).toEqual(['date-future']);
    expect(dob('13/09/2026')[0]?.message).toContain('12/09/2026');
    expect(errors(dob('01/01/2027'))).toEqual(['date-future']);
    expect(errors(dob('31/12/2025'))).toEqual([]);
    // The boundary moves with the reference date, never with the machine clock.
    const fields = eciIssues().map((current) => (current.key === 'eci-dob' ? { ...current, value: '13/09/2026' } : current));
    const later = validateSnapshot({ origin: PRACTICE, fields, gaps: [], reference: { englishName: '' }, today: { year: 2026, month: 9, day: 13 } });
    expect(later.some((result) => result.ruleId === 'date-future')).toBe(false);
  });

  it('rejects year zero and impossible dates, and accepts leap days', () => {
    expect(errors(dob('01/01/0000'))).toEqual(['date-calendar']);
    expect(dob('01/01/0000')[0]?.message).toContain('Year 0');
    expect(errors(dob('29/02/2024'))).toEqual([]);
    expect(errors(dob('29/02/2023'))).toEqual(['date-calendar']);
    expect(errors(dob('31/02/2000'))).toEqual(['date-calendar']);
    expect(errors(dob('15/13/2000'))).toEqual(['date-calendar']);
    expect(errors(dob('2000-08-15'))).toEqual(['date-format']);
    expect(calendarProblem('01/01/0000')).toEqual({ kind: 'year' });
  });

  it('reads native date values and enforces only the bounds the control declares', () => {
    const native = { constraints: { control: 'date', min: '1900-01-01', max: '2026-09-12' } };
    expect(errors(dob('2004-08-15', native))).toEqual([]);
    expect(errors(dob('2004-02-29', native))).toEqual([]);
    expect(errors(dob('2026-09-12', native))).toEqual([]);
    expect(errors(dob('2026-09-13', native))).toEqual(['date-future']);
    expect(errors(dob('1899-12-31', native))).toEqual(['date-bounds']);
    expect(dob('1899-12-31', native)[0]?.message).toContain('01/01/1900');
    expect(errors(dob('0000-01-01', native))).toEqual(['date-calendar']);
    expect(errors(dob('15/08/2004', native))).toEqual(['date-format']);
    expect(errors(dob('2004-08-15', { constraints: { control: 'date', min: null, max: '2000-01-01' } }))).toEqual(['date-bounds']);
    // A text input has no native bounds, whatever attributes the page put on it.
    expect(errors(dob('31/12/1899', { constraints: { control: 'text', min: '1900-01-01', max: null } }))).toEqual([]);
    expect(calendarProblem('2004-08-15', 'date')).toBeNull();
    expect(calendarProblem('2004-08-15')).toEqual({ kind: 'format' });
  });

  it('separates date validity from eligibility, which is never decided', () => {
    const results = validateSnapshot({ origin: PRACTICE, fields: eciIssues(), gaps: [], reference: { englishName: '' }, today });
    const note = results.find((result) => result.ruleId === 'dob-eligibility-unchecked');
    expect(note?.severity).toBe('unchecked');
    expect(note?.fieldId).toBeNull();
    expect(note?.message).toContain('No minimum or maximum age');
    expect(summarizeReview([note!], [], []).permanentLimits).toBe(1);
    // Born today or in year 1: valid dates, and no age judgement either way.
    expect(errors(dob('12/09/2026'))).toEqual([]);
    expect(errors(dob('01/01/0001'))).toEqual([]);
    expect(dob('12/09/2026').some((result) => /age|eligibility/.test(result.message) && result.severity === 'error')).toBe(false);
    // A page without a date-of-birth field carries no such note.
    const noDob = validateSnapshot({ origin: PRACTICE, fields: eciIssues().filter((current) => current.key !== 'eci-dob'), gaps: [], reference: { englishName: '' }, today });
    expect(noDob.some((result) => result.ruleId === 'dob-eligibility-unchecked')).toBe(false);
  });

  it('defaults to the local calendar date of the machine, with no time-zone conversion', () => {
    expect(localToday(new Date(2026, 8, 12, 23, 59, 59))).toEqual({ year: 2026, month: 9, day: 12 });
    expect(localToday(new Date(2026, 0, 1, 0, 0, 0))).toEqual({ year: 2026, month: 1, day: 1 });
    expect(formatDate({ year: 1, month: 1, day: 1 })).toBe('01/01/0001');
    const fields = eciIssues().map((current) => (current.key === 'eci-dob' ? { ...current, value: '01/01/9999' } : current));
    const results = validateSnapshot({ origin: PRACTICE, fields, gaps: [], reference: { englishName: '' } });
    expect(results.find((result) => result.fieldId === 'id-eci-dob' && result.severity === 'error')?.ruleId).toBe('date-future');
  });
});

it('changes presentation only across locales without mutating input or deterministic results', () => {
  const fields = nspIssues();
  const input = { origin: 'http://localhost', fields, gaps: [{ reason: 'frame', label: 'Original—frame' }], reference: { englishName: 'KAVYA SAIN' } };
  const before = JSON.stringify(input);
  const english = validateSnapshot(input);
  const canonical = (results: ReturnType<typeof validateSnapshot>) => results.map(({ message: _message, action: _action, ...result }) => result);
  for (const locale of ['hi', 'es', 'fr', 'ar'] as const) {
    const translated = validateSnapshot({ ...input, locale });
    expect(canonical(translated)).toEqual(canonical(english));
    expect(translated.at(-1)?.message).toContain('Original—frame');
    expect(translated.at(-1)?.message).not.toBe(english.at(-1)?.message);
  }
  expect(JSON.stringify(input)).toBe(before);
});
