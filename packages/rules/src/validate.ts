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
};

export type ValidationInput = {
  origin: string;
  fields: readonly ValidationField[];
  gaps: readonly { reason: string; label: string }[];
  /**
   * Exact spelling the person supplied from their own document. It is never
   * inferred from speech, from the page, or from the Hindi name.
   */
  reference: { englishName: string };
};

const DEVANAGARI_DIGITS = /[०-९]/g;
// A separate non-global copy: `.test()` on a /g regex keeps its lastIndex.
const HAS_DEVANAGARI_DIGIT = /[०-९]/;
const DATE_PARTS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
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
  | { kind: 'month' }
  | { kind: 'day'; month: number; year: number; days: number };

/** Strict calendar check. It says nothing about age, eligibility or plausibility. */
export function calendarProblem(value: string): DateProblem | null {
  const parts = DATE_PARTS.exec(normalizeDigits(value).trim());
  if (!parts) return { kind: 'format' };
  const day = Number(parts[1]);
  const month = Number(parts[2]);
  const year = Number(parts[3]);
  if (month < 1 || month > 12) return { kind: 'month' };
  const days = daysInMonth(month, year);
  if (day < 1 || day > days) return { kind: 'day', month, year, days };
  return null;
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

function dateCheck(field: ValidationField, rule: FieldRule): ValidationResult[] {
  const value = text(field);
  if (value === '') return [];
  const problem = calendarProblem(value);
  if (problem === null) return [];
  const action = rule.requirement === 'read-only'
    ? 'यह जानकारी दूसरी जगह से आती है; सुधार वहीं करना होगा।'
    : 'तारीख फिर देखें और सुधारें।';
  if (problem.kind === 'format') {
    return [{
      ruleId: 'date-format',
      fieldId: field.fieldId,
      severity: 'error',
      message: `${field.label}: तारीख दिन/महीना/वर्ष के रूप में नहीं लिखी है।`,
      action: `${action} जैसे 15/08/2000।`,
      source: rule.source,
    }];
  }
  if (problem.kind === 'month') {
    return [{
      ruleId: 'date-calendar',
      fieldId: field.fieldId,
      severity: 'error',
      message: `${field.label}: महीना 1 से 12 के बीच होना चाहिए।`,
      action,
      source: rule.source,
    }];
  }
  return [{
    ruleId: 'date-calendar',
    fieldId: field.fieldId,
    severity: 'error',
    message: `${field.label}: महीना ${problem.month}, वर्ष ${problem.year} में केवल ${problem.days} दिन होते हैं।`,
    action,
    source: rule.source,
  }];
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
    let unmapped = 0;
    let pinPresent = false;
    let otrPresent = false;
    let ifscPresent = false;
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
      results.push(...requiredCheck(field, rule, input.fields));
      if (rule.meaning === 'date-of-birth') results.push(...dateCheck(field, rule));
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
