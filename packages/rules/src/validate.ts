import { translator, type Locale, type Translator } from '@form-saathi/contracts';
import { selectRulePack, type FieldRule, type RulePack } from './packs.js';

// Deterministic local checks. Nothing here contacts a service, guesses a field's
// meaning from its value, or decides eligibility, identity or acceptance.

export type Severity = 'error' | 'needs-confirmation' | 'unchecked';

export type ValidationResult = {
  /** Stable rule identifier. */
  ruleId: string;
  /** The panel's field identifier, or null for a result about the whole page. */
  fieldId: string | null;
  severity: Severity;
  /** Localized explanation, rendered from stable message keys. */
  message: string;
  /** Localized next action. */
  action: string;
  /** Source register or fixture-assumption id behind the rule, when it has one. */
  source: string | null;
};

/** The part of a read field these checks use. */
export type ValidationField = {
  fieldId: string;
  key: string;
  label: string;
  kind: string;
  status: 'read' | 'inactive';
  required: boolean;
  value: string | null;
  options: readonly { value: string; label: string; selected: boolean }[];
  /** The control's own kind and native bounds; a date input serialises ISO dates. */
  constraints?: { control: string; min: string | null; max: string | null };
};

export type CalendarDate = { year: number; month: number; day: number };

export type ValidationInput = {
  /** Presentation only. Never participates in validation or review revisions. */
  locale?: Locale;
  origin: string;
  fields: readonly ValidationField[];
  gaps: readonly { reason: string; label: string }[];
  /**
   * Exact spelling the person supplied from their own document. It is never
   * inferred from speech, from the page, or from the Hindi name.
   */
  reference: { englishName: string };
  /** The reference date for "not in the future"; defaults to `localToday()`. */
  today?: CalendarDate;
};

const DEVANAGARI_DIGITS = /[०-९]/g;
// A separate non-global copy: `.test()` on a /g regex keeps its lastIndex.
const HAS_DEVANAGARI_DIGIT = /[०-९]/;
const DATE_PARTS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
/** What a native date control holds: an HTML valid date string, whatever the locale. */
const ISO_DATE = /^(\d{4,})-(\d{2})-(\d{2})$/;
const SIX_DIGITS = /^\d{6}$/;
const FOURTEEN_DIGITS = /^\d{14}$/;
const IFSC_CODE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Devanagari digits map one to one onto 0-9; no number words are interpreted. */
export function normalizeDigits(value: string): string {
  return value.replace(DEVANAGARI_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0966));
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(month: number, year: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export type DateProblem =
  | { kind: 'format' }
  | { kind: 'year' }
  | { kind: 'month' }
  | { kind: 'day'; month: number; year: number; days: number };

/**
 * Date policy: "today" is the calendar date of the machine running the check,
 * in its own local time zone, read at the moment of the check. No time-zone
 * conversion is applied and no server clock is consulted, because the check
 * runs in the person's browser. A date equal to today is not in the future.
 * Callers that need a fixed reference pass `today` themselves.
 */
export function localToday(now = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function compareDates(left: CalendarDate, right: CalendarDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

export function formatDate(date: CalendarDate): string {
  return `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}/${String(date.year).padStart(4, '0')}`;
}

/**
 * Strict calendar parse of the formats supported controls actually produce:
 * day/month/year text, or the ISO value of a native date input. It says
 * nothing about age, eligibility or plausibility.
 */
export function parseDate(value: string, control = 'text'): { date: CalendarDate } | { problem: DateProblem } {
  const text = normalizeDigits(value).trim();
  const native = control === 'date';
  const parts = (native ? ISO_DATE : DATE_PARTS).exec(text);
  if (!parts) return { problem: { kind: 'format' } };
  const day = Number(native ? parts[3] : parts[1]);
  const month = Number(parts[2]);
  const year = Number(native ? parts[1] : parts[3]);
  // The proleptic Gregorian calendar HTML dates use has no year zero.
  if (year < 1) return { problem: { kind: 'year' } };
  if (month < 1 || month > 12) return { problem: { kind: 'month' } };
  const days = daysInMonth(month, year);
  if (day < 1 || day > days) return { problem: { kind: 'day', month, year, days } };
  return { date: { year, month, day } };
}

export function calendarProblem(value: string, control = 'text'): DateProblem | null {
  const parsed = parseDate(value, control);
  return 'problem' in parsed ? parsed.problem : null;
}

function text(field: ValidationField): string {
  return (field.value ?? '').replace(/\s+/g, ' ').trim();
}

function isChoice(field: ValidationField): boolean {
  return field.kind === 'radio-group' || field.kind === 'select';
}

function conditionHolds(rule: FieldRule, fields: readonly ValidationField[]): boolean | null {
  if (!rule.when) return false;
  const control = fields.find((field) => field.key === rule.when?.key);
  if (!control || control.status !== 'read') return null;
  return text(control) === rule.when.value;
}

function requiredCheck(
  field: ValidationField,
  rule: FieldRule,
  fields: readonly ValidationField[],
  t: Translator,
): ValidationResult[] {
  if (rule.requirement === 'read-only' || rule.requirement === 'optional') return [];
  if (rule.requirement === 'conditional') {
    const holds = conditionHolds(rule, fields);
    if (holds === null) {
      return [{
        ruleId: 'conditional-unknown',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: t('v.conditional', { label: field.label }),
        action: t('v.readPortal'),
        source: rule.source,
      }];
    }
    if (!holds) return [];
  }
  if (text(field) !== '') return [];
  return [{
    ruleId: 'required-value',
    fieldId: field.fieldId,
    severity: 'error',
    message: t('v.required', { label: field.label }),
    action: isChoice(field) ? t('v.choose') : t('v.fill'),
    source: rule.source,
  }];
}

/**
 * Date of birth: a real calendar date, not after today, and within the bounds
 * the page's own date control declares. Validity only: no minimum age, maximum
 * age or historical cutoff is assumed, because no reviewed source states one.
 */
function dateCheck(field: ValidationField, rule: FieldRule, today: CalendarDate, t: Translator): ValidationResult[] {
  const value = text(field);
  if (value === '') return [];
  const control = field.constraints?.control ?? 'text';
  const parsed = parseDate(value, control);
  const action = rule.requirement === 'read-only'
    ? t('v.upstream')
    : t('v.dateAction');
  const error = (ruleId: string, message: string, next = action): ValidationResult => ({
    ruleId, fieldId: field.fieldId, severity: 'error', message: message, action: next, source: rule.source,
  });
  if ('problem' in parsed) {
    const { problem } = parsed;
    switch (problem.kind) {
      case 'format':
        return [error('date-format', control === 'date'
          ? t('v.dateNative', { label: field.label })
          : t('v.dateFormat', { label: field.label }), t('v.dateExample', { action }))];
      case 'year':
        return [error('date-calendar', t('v.dateYear', { label: field.label }))];
      case 'month':
        return [error('date-calendar', t('v.dateMonth', { label: field.label }))];
      case 'day':
        return [error('date-calendar', t('v.dateDay', { label: field.label, ...problem }))];
    }
  }
  const { date } = parsed;
  if (compareDates(date, today) > 0) {
    return [error('date-future', t('v.dateFuture', { label: field.label, today: formatDate(today) }))];
  }
  // Only a native date control enforces its own bounds; text inputs have none.
  if (control === 'date') {
    for (const [edge, bound] of [['min', field.constraints?.min], ['max', field.constraints?.max]] as const) {
      if (!bound) continue;
      const limit = parseDate(bound, 'date');
      if ('problem' in limit) continue;
      const outside = edge === 'min' ? compareDates(date, limit.date) < 0 : compareDates(date, limit.date) > 0;
      if (outside) {
        return [error('date-bounds', t(edge === 'min' ? 'v.dateMin' : 'v.dateMax', { label: field.label, date: formatDate(limit.date) }))];
      }
    }
  }
  return [];
}

function identifierCheck(field: ValidationField, rule: FieldRule, t: Translator): ValidationResult[] {
  const value = normalizeDigits(text(field));
  if (value === '') return [];
  switch (rule.meaning) {
    case 'postal-pin':
      return SIX_DIGITS.test(value) ? [] : [{
        ruleId: 'pin-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: t('v.pin', { label: field.label, count: value.length }),
        action: t('v.pinAction'),
        source: rule.source,
      }];
    case 'nsp-otr':
      return FOURTEEN_DIGITS.test(value) ? [] : [{
        ruleId: 'otr-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: t('v.otr', { label: field.label, count: value.length }),
        action: t('v.otrAction'),
        source: 'N1',
      }];
    case 'ifsc':
      return IFSC_CODE.test(value.toUpperCase()) ? [] : [{
        ruleId: 'ifsc-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: t('v.ifsc', { label: field.label }),
        action: t('v.ifscAction'),
        source: 'B1',
      }];
    // No verified specification is on file, so nothing about these is checked.
    case 'aadhaar':
      return [{
        ruleId: 'aadhaar-unchecked',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: t('v.aadhaar', { label: field.label }),
        action: t('v.aadhaarAction'),
        source: 'U1',
      }];
    case 'aadhaar-eid':
      return [{
        ruleId: 'aadhaar-eid-unchecked',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: t('v.eid', { label: field.label }),
        action: t('v.eidAction'),
        source: 'U1',
      }];
    default:
      return [];
  }
}

function nameCheck(
  field: ValidationField,
  rule: FieldRule,
  reference: string,
  t: Translator,
): ValidationResult[] {
  const value = text(field);
  const wanted = reference.replace(/\s+/g, ' ').trim();
  if (value === '') {
    if (rule.requirement === 'required') return [];
    return [{
      ruleId: 'name-reference',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: t('v.nameEmpty', { label: field.label }),
      action: t('v.nameEmptyAction'),
      source: rule.source,
    }];
  }
  if (wanted === '') {
    return [{
      ruleId: 'name-reference',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: t('v.nameReference', { label: field.label }),
      action: t('v.nameReferenceAction'),
      source: null,
    }];
  }
  if (value === wanted) return [];
  return [{
    ruleId: 'name-reference',
    fieldId: field.fieldId,
    severity: 'needs-confirmation',
    message: t('v.nameMismatch', { label: field.label, value, wanted }),
    action: t('v.nameAction')
      + (rule.requirement === 'read-only'
        ? ` ${t('v.upstream')}`
        : ''),
    source: null,
  }];
}

function meaningNotes(field: ValidationField, rule: FieldRule, t: Translator): ValidationResult[] {
  const results: ValidationResult[] = [];
  const value = text(field);
  if (rule.meaning === 'unknown' && value !== '') {
    results.push({
      ruleId: 'unknown-meaning',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: t('v.unknown', { label: field.label }),
      action: t('v.readPortal'),
      source: rule.source,
    });
  }
  if (HAS_DEVANAGARI_DIGIT.test(value)) {
    results.push({
      ruleId: 'devanagari-digits',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: t('v.digits', { label: field.label }),
      action: t('v.digitsAction'),
      source: null,
    });
  }
  return results;
}

function packNotes(pack: RulePack, via: 'host' | 'practice', t: Translator): ValidationResult[] {
  const where = via === 'practice'
    ? t('v.practice')
    : t('v.host');
  return [{
    ruleId: 'live-testing-unverified',
    fieldId: null,
    severity: 'unchecked',
    message: t('v.pack', { id: pack.id, version: pack.version, reviewed: pack.reviewed, where }),
    action: t('v.packAction'),
    source: pack.id,
  }];
}

/** Runs one pack against a page. `validateSnapshot` chooses the pack itself. */
export function validateWithPack(
  pack: RulePack,
  via: 'host' | 'practice',
  input: ValidationInput,
): ValidationResult[] {
  const t = translator(input.locale);
  const results: ValidationResult[] = [];
  {
    const selection = { pack, via };
    results.push(...packNotes(selection.pack, selection.via, t));
    const today = input.today ?? localToday();
    let unmapped = 0;
    let pinPresent = false;
    let otrPresent = false;
    let ifscPresent = false;
    let dobPresent = false;
    for (const field of input.fields) {
      const rule = selection.pack.fields.find((mapping) => mapping.key === field.key);
      if (!rule) {
        // The page's own required marker is evidence; its meaning still is not.
        if (field.status === 'read' && field.required && text(field) === '') {
          results.push({
            ruleId: 'required-value',
            fieldId: field.fieldId,
            severity: 'error',
            message: t('v.pageRequired', { label: field.label }),
            action: isChoice(field) ? t('v.choose') : t('v.fill'),
            source: 'page-required',
          });
        }
        unmapped += 1;
        continue;
      }
      // A hidden or disabled control is not applicable, so nothing is claimed.
      if (field.status !== 'read') continue;
      pinPresent ||= rule.meaning === 'postal-pin';
      otrPresent ||= rule.meaning === 'nsp-otr';
      ifscPresent ||= rule.meaning === 'ifsc';
      dobPresent ||= rule.meaning === 'date-of-birth';
      results.push(...requiredCheck(field, rule, input.fields, t));
      if (rule.meaning === 'date-of-birth') results.push(...dateCheck(field, rule, today, t));
      if (rule.meaning === 'english-name') results.push(...nameCheck(field, rule, input.reference.englishName, t));
      results.push(...identifierCheck(field, rule, t));
      results.push(...meaningNotes(field, rule, t));
    }
    if (unmapped > 0) {
      results.push({
        ruleId: 'unmapped-fields',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.unmapped', { count: unmapped }),
        action: t('v.checkList'),
        source: selection.pack.id,
      });
    }
    if (pinPresent) {
      results.push({
        ruleId: 'pin-district-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.pinDistrict'),
        action: t('v.pinDistrictAction'),
        source: null,
      });
    }
    if (otrPresent) {
      results.push({
        ruleId: 'otr-issuance-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.otrIssuance'),
        action: t('v.confirmPortal'),
        source: 'N1',
      });
    }
    if (dobPresent) {
      // Validity and eligibility are different questions; only the first is answered here.
      results.push({
        ruleId: 'dob-eligibility-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.dobEligibility'),
        action: t('v.readPortal'),
        source: null,
      });
    }
    if (ifscPresent) {
      results.push({
        ruleId: 'ifsc-branch-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.ifscBranch'),
        action: t('v.bankAction'),
        source: 'B1',
      });
    }
  }
  return results;
}

export function validateSnapshot(input: ValidationInput): ValidationResult[] {
  const t = translator(input.locale);
  const selection = selectRulePack(input.origin, input.fields.map((field) => field.key));
  const results: ValidationResult[] = [];
  if (!input.fields.some((field) => field.status === 'read')) {
    // Nothing applicable was read, so no review of a form has taken place.
    results.push({
      ruleId: 'no-readable-fields',
      fieldId: null,
      severity: 'unchecked',
      message: t('v.noReadable'),
      action: t('v.openForm'),
      source: null,
    });
  }
  if (selection.pack === null) {
    results.push({
      ruleId: 'no-rule-pack',
      fieldId: null,
      severity: 'unchecked',
      message: t(selection.reason === 'no-fields' ? 'v.noFields' : selection.reason === 'no-workflow' ? 'v.noWorkflow' : 'v.noPack'),
      action: t('v.checkList'),
      source: null,
    });
  } else {
    results.push(...validateWithPack(selection.pack, selection.via, input));
    if (selection.missing.length > 0) {
      // The workflow was recognised, but part of it is not on this page.
      results.push({
        ruleId: 'expected-fields-missing',
        fieldId: null,
        severity: 'unchecked',
        message: t('v.missing', { count: selection.missing.length, keys: selection.missing.map((rule) => rule.key).join(', ') }),
        action: t('v.manual'),
        source: selection.pack.id,
      });
    }
  }

  for (const gap of input.gaps) {
    results.push({
      ruleId: 'coverage-gap',
      fieldId: null,
      severity: 'unchecked',
      message: t(gap.reason === 'frame' ? 'v.frame' : gap.reason === 'sensitive' ? 'v.sensitive' : gap.reason === 'unsupported-control' ? 'v.unsupported-control' : 'v.gap', { label: gap.label }),
      action: t('v.manual'),
      source: null,
    });
  }
  return results;
}
