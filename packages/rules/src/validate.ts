import { selectRulePack, type FieldRule, type PackSelection, type RulePack } from './packs.js';

// Deterministic local checks. Nothing here contacts a service, guesses a field's
// meaning from its value, or decides eligibility, identity or acceptance.

export type Severity = 'error' | 'needs-confirmation' | 'unchecked';

export type ValidationResult = {
  /** Stable rule identifier. */
  ruleId: string;
  /** The panel's field identifier, or null for a result about the whole page. */
  fieldId: string | null;
  severity: Severity;
  /** Concise Hindi explanation. */
  message: string;
  /** Suggested next action, in Hindi. */
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

const gapText: Record<string, string> = {
  frame: 'अलग फ़्रेम — इसकी सामग्री नहीं पढ़ी गई',
  sensitive: 'संवेदनशील फ़ील्ड — जानबूझकर नहीं पढ़ा गया',
  'unsupported-control': 'असमर्थित नियंत्रण — नहीं पढ़ा गया',
};

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
): ValidationResult[] {
  if (rule.requirement === 'read-only' || rule.requirement === 'optional') return [];
  if (rule.requirement === 'conditional') {
    const holds = conditionHolds(rule, fields);
    if (holds === null) {
      return [{
        ruleId: 'conditional-unknown',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: `${field.label}: यह कब आवश्यक है, यह तय करने वाला फ़ील्ड नहीं मिला।`,
        action: 'पोर्टल के निर्देश स्वयं पढ़ें।',
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
    message: `${field.label}: यह जानकारी अभी नहीं भरी गई।`,
    action: isChoice(field) ? 'फ़ील्ड पर जाएँ और विकल्प चुनें।' : 'फ़ील्ड पर जाएँ और भरें।',
    source: rule.source,
  }];
}

/**
 * Date of birth: a real calendar date, not after today, and within the bounds
 * the page's own date control declares. Validity only: no minimum age, maximum
 * age or historical cutoff is assumed, because no reviewed source states one.
 */
function dateCheck(field: ValidationField, rule: FieldRule, today: CalendarDate): ValidationResult[] {
  const value = text(field);
  if (value === '') return [];
  const control = field.constraints?.control ?? 'text';
  const parsed = parseDate(value, control);
  const action = rule.requirement === 'read-only'
    ? 'यह जानकारी दूसरी जगह से आती है; सुधार वहीं करना होगा।'
    : 'तारीख फिर देखें और सुधारें।';
  const error = (ruleId: string, message: string, next = action): ValidationResult => ({
    ruleId, fieldId: field.fieldId, severity: 'error', message: `${field.label}: ${message}`, action: next, source: rule.source,
  });
  if ('problem' in parsed) {
    const { problem } = parsed;
    switch (problem.kind) {
      case 'format':
        return [error('date-format', control === 'date'
          ? 'तारीख पढ़ी नहीं जा सकी; तारीख नियंत्रण में उसे फिर चुनें।'
          : 'तारीख दिन/महीना/वर्ष के रूप में नहीं लिखी है।', `${action} जैसे 15/08/2000।`)];
      case 'year':
        return [error('date-calendar', 'वर्ष 0 कोई वर्ष नहीं होता; चार अंकों का वास्तविक वर्ष लिखें।')];
      case 'month':
        return [error('date-calendar', 'महीना 1 से 12 के बीच होना चाहिए।')];
      case 'day':
        return [error('date-calendar', `महीना ${problem.month}, वर्ष ${problem.year} में केवल ${problem.days} दिन होते हैं।`)];
    }
  }
  const { date } = parsed;
  if (compareDates(date, today) > 0) {
    return [error('date-future', `यह तारीख आज (${formatDate(today)}) के बाद की है; जन्म तारीख भविष्य की नहीं हो सकती।`)];
  }
  // Only a native date control enforces its own bounds; text inputs have none.
  if (control === 'date') {
    for (const [edge, bound] of [['min', field.constraints?.min], ['max', field.constraints?.max]] as const) {
      if (!bound) continue;
      const limit = parseDate(bound, 'date');
      if ('problem' in limit) continue;
      const outside = edge === 'min' ? compareDates(date, limit.date) < 0 : compareDates(date, limit.date) > 0;
      if (outside) {
        return [error('date-bounds', `पेज इस फ़ील्ड में ${formatDate(limit.date)} ${edge === 'min' ? 'से पहले' : 'के बाद'} की तारीख नहीं लेता।`)];
      }
    }
  }
  return [];
}

function identifierCheck(field: ValidationField, rule: FieldRule): ValidationResult[] {
  const value = normalizeDigits(text(field));
  if (value === '') return [];
  switch (rule.meaning) {
    case 'postal-pin':
      return SIX_DIGITS.test(value) ? [] : [{
        ruleId: 'pin-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: `${field.label}: इस अभ्यास में PIN छह अंकों का माना गया है; अभी ${value.length} वर्ण हैं।`,
        action: 'छह अंकों का डाक PIN भरें।',
        source: rule.source,
      }];
    case 'nsp-otr':
      return FOURTEEN_DIGITS.test(value) ? [] : [{
        ruleId: 'otr-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: `${field.label}: NSP के अनुसार OTR 14 अंकों का होता है; अभी ${value.length} वर्ण हैं। यह Aadhaar नहीं है।`,
        action: 'अपना OTR संदर्भ फिर देखें।',
        source: 'N1',
      }];
    case 'ifsc':
      return IFSC_CODE.test(value.toUpperCase()) ? [] : [{
        ruleId: 'ifsc-format',
        fieldId: field.fieldId,
        severity: 'error',
        message: `${field.label}: IFSC 11 वर्णों का होता है — पहले 4 अक्षर बैंक, पाँचवाँ 0, अंतिम 6 शाखा।`,
        action: 'अपनी पासबुक या बैंक से IFSC फिर देखें।',
        source: 'B1',
      }];
    // No verified specification is on file, so nothing about these is checked.
    case 'aadhaar':
      return [{
        ruleId: 'aadhaar-unchecked',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: `${field.label}: Aadhaar की सत्यापित विधि इस संस्करण में दर्ज नहीं है, इसलिए न रूप जाँचा गया, न checksum।`,
        action: 'अपने Aadhaar पत्र से स्वयं मिलान करें।',
        source: 'U1',
      }];
    case 'aadhaar-eid':
      return [{
        ruleId: 'aadhaar-eid-unchecked',
        fieldId: field.fieldId,
        severity: 'unchecked',
        message: `${field.label}: EID (नामांकन क्रमांक) Aadhaar संख्या से अलग है, और इसकी सत्यापित विधि दर्ज नहीं है।`,
        action: 'अपनी नामांकन पर्ची से स्वयं मिलान करें।',
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
): ValidationResult[] {
  const value = text(field);
  const wanted = reference.replace(/\s+/g, ' ').trim();
  if (value === '') {
    if (rule.requirement === 'required') return [];
    return [{
      ruleId: 'name-reference',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: `${field.label} खाली है, इसलिए वर्तनी की तुलना नहीं हुई।`,
      action: 'खाली छोड़ना हो तो छोड़ें; भरने पर तुलना फिर होगी।',
      source: rule.source,
    }];
  }
  if (wanted === '') {
    return [{
      ruleId: 'name-reference',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: `${field.label}: आपने कोई संदर्भ वर्तनी नहीं दी, इसलिए तुलना नहीं हुई।`,
      action: 'पैनल में अपने दस्तावेज़ की सटीक अंग्रेज़ी वर्तनी लिखें।',
      source: null,
    }];
  }
  if (value === wanted) return [];
  return [{
    ruleId: 'name-reference',
    fieldId: field.fieldId,
    severity: 'needs-confirmation',
    message: `${field.label}: फ़ॉर्म में “${value}” है, आपके संदर्भ में “${wanted}”।`,
    action: 'अपने दस्तावेज़ से तय करें कि कौन सी वर्तनी सही है। बोलकर वर्तनी तय नहीं होती।'
      + (rule.requirement === 'read-only'
        ? ' यह फ़ील्ड यहाँ नहीं बदलता; सुधार वहीं से होगा जहाँ से यह आता है।'
        : ''),
    source: null,
  }];
}

function meaningNotes(field: ValidationField, rule: FieldRule): ValidationResult[] {
  const results: ValidationResult[] = [];
  const value = text(field);
  if (rule.meaning === 'unknown' && value !== '') {
    results.push({
      ruleId: 'unknown-meaning',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: `${field.label}: इस फ़ील्ड का अर्थ तय नहीं है, इसलिए जाँच नहीं हुई। अंकों की संख्या से पहचान का प्रकार नहीं माना गया।`,
      action: 'पोर्टल के अपने निर्देश पढ़कर स्वयं जाँचें।',
      source: rule.source,
    });
  }
  if (HAS_DEVANAGARI_DIGIT.test(value)) {
    results.push({
      ruleId: 'devanagari-digits',
      fieldId: field.fieldId,
      severity: 'unchecked',
      message: `${field.label}: मान में देवनागरी अंक हैं। पोर्टल इन्हें स्वीकार करता है या नहीं, यह जाँचा नहीं गया।`,
      action: 'ज़रूरत लगे तो 0-9 अंकों में लिखें।',
      source: null,
    });
  }
  return results;
}

function packNotes(pack: RulePack, via: 'host' | 'practice'): ValidationResult[] {
  const where = via === 'practice'
    ? 'यह स्थानीय अभ्यास पेज है और पैक फ़ील्ड-नामों से मिलाया गया।'
    : 'यह पैक इस पोर्टल के लिए बनाया गया है, पर इसके फ़ील्ड-नाम लाइव पेज पर सत्यापित नहीं हैं।';
  return [{
    ruleId: 'live-testing-unverified',
    fieldId: null,
    severity: 'unchecked',
    message: `नियम पैक ${pack.id} ${pack.version} (समीक्षा ${pack.reviewed}) का लाइव परीक्षण बाकी है। ${where}`,
    action: 'इन नतीजों को अंतिम पुष्टि या आवेदन भेजने की अनुमति न मानें।',
    source: pack.id,
  }];
}

/** Runs one pack against a page. `validateSnapshot` chooses the pack itself. */
export function validateWithPack(
  pack: RulePack,
  via: 'host' | 'practice',
  input: ValidationInput,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  {
    const selection = { pack, via };
    results.push(...packNotes(selection.pack, selection.via));
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
            message: `${field.label}: पेज ने इसे आवश्यक बताया है और यह अभी खाली है।`,
            action: isChoice(field) ? 'फ़ील्ड पर जाएँ और विकल्प चुनें।' : 'फ़ील्ड पर जाएँ और भरें।',
            source: 'पेज का अपना आवश्यक चिह्न',
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
      results.push(...requiredCheck(field, rule, input.fields));
      if (rule.meaning === 'date-of-birth') results.push(...dateCheck(field, rule, today));
      if (rule.meaning === 'english-name') results.push(...nameCheck(field, rule, input.reference.englishName));
      results.push(...identifierCheck(field, rule));
      results.push(...meaningNotes(field, rule));
    }
    if (unmapped > 0) {
      results.push({
        ruleId: 'unmapped-fields',
        fieldId: null,
        severity: 'unchecked',
        message: `${unmapped} फ़ील्ड इस नियम पैक में दर्ज नहीं हैं, इसलिए उनकी जाँच नहीं हुई।`,
        action: 'इन फ़ील्ड को सूची में स्वयं पढ़ें।',
        source: selection.pack.id,
      });
    }
    if (pinPresent) {
      results.push({
        ruleId: 'pin-district-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: 'PIN और जिले का आपस में मेल नहीं जाँचा गया: इसके लिए समीक्षित डाक निर्देशिका नहीं है।',
        action: 'सही डाक निर्देशिका या अपने पते के दस्तावेज़ से स्वयं मिलान करें।',
        source: null,
      });
    }
    if (otrPresent) {
      results.push({
        ruleId: 'otr-issuance-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: 'OTR किसका है और वह जारी हुआ है या नहीं, यह जाँचा नहीं गया। 14 अंक होना पहचान प्रमाणित नहीं करता।',
        action: 'पोर्टल पर स्वयं पुष्टि करें।',
        source: 'N1',
      });
    }
    if (dobPresent) {
      // Validity and eligibility are different questions; only the first is answered here.
      results.push({
        ruleId: 'dob-eligibility-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: 'जन्म तारीख से आयु या पात्रता नहीं जाँची गई: केवल तारीख की वैधता देखी गई है, कोई न्यूनतम या अधिकतम आयु नहीं मानी गई।',
        action: 'पात्रता की शर्तें पोर्टल के अपने निर्देशों से स्वयं देखें।',
        source: null,
      });
    }
    if (ifscPresent) {
      results.push({
        ruleId: 'ifsc-branch-unchecked',
        fieldId: null,
        severity: 'unchecked',
        message: 'IFSC का रूप ही देखा गया। शाखा, खाता या नाम का मिलान नहीं हुआ।',
        action: 'बैंक से स्वयं पुष्टि करें।',
        source: 'B1',
      });
    }
  }
  return results;
}

const noPackText: Record<Exclude<PackSelection, { pack: RulePack }>['reason'], string> = {
  'no-fields': 'इस पेज पर कोई पढ़ने योग्य फ़ील्ड नहीं मिला, इसलिए कोई जाँच नहीं हुई। यह किसी फ़ॉर्म की समीक्षा नहीं है।',
  'no-workflow': 'पोर्टल पहचाना गया, पर यह पेज किसी समीक्षित कार्यप्रवाह से मेल नहीं खाता: उसके पहचान-फ़ील्ड यहाँ नहीं मिले। किसी फ़ील्ड की जाँच नहीं हुई।',
  'unknown-page': 'इस पेज के लिए कोई समीक्षित नियम पैक नहीं है, इसलिए किसी फ़ील्ड की जाँच नहीं हुई।',
};

export function validateSnapshot(input: ValidationInput): ValidationResult[] {
  const selection = selectRulePack(input.origin, input.fields.map((field) => field.key));
  const results: ValidationResult[] = [];
  if (!input.fields.some((field) => field.status === 'read')) {
    // Nothing applicable was read, so no review of a form has taken place.
    results.push({
      ruleId: 'no-readable-fields',
      fieldId: null,
      severity: 'unchecked',
      message: 'इस पेज पर कोई लागू फ़ील्ड पढ़ा नहीं गया, इसलिए यह किसी फ़ॉर्म की समीक्षा नहीं है।',
      action: 'सही फ़ॉर्म पेज खोलकर उसे फिर पढ़ें।',
      source: null,
    });
  }
  if (selection.pack === null) {
    results.push({
      ruleId: 'no-rule-pack',
      fieldId: null,
      severity: 'unchecked',
      message: noPackText[selection.reason],
      action: 'फ़ील्ड सूची पढ़कर जानकारी स्वयं जाँचें।',
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
        message: `इस कार्यप्रवाह के ${selection.missing.length} अपेक्षित फ़ील्ड इस पेज पर नहीं मिले, इसलिए उनकी जाँच नहीं हुई: ${selection.missing.map((rule) => rule.key).join(', ')}।`,
        action: 'पोर्टल पर वे हिस्से स्वयं देखें; यह समीक्षा उन्हें नहीं ढकती।',
        source: selection.pack.id,
      });
    }
  }

  for (const gap of input.gaps) {
    results.push({
      ruleId: 'coverage-gap',
      fieldId: null,
      severity: 'unchecked',
      message: `${gapText[gap.reason] ?? 'नहीं पढ़ा गया'}: ${gap.label}`,
      action: 'इस हिस्से को स्वयं जाँचें।',
      source: null,
    });
  }
  return results;
}
