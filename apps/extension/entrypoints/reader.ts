import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { snapshotRevision } from '@form-saathi/rules';
import {
  readerRequestSchema,
  type CoverageGap,
  type FormField,
  type FormSnapshot,
  type ReaderReply,
} from '@form-saathi/contracts';

// Injected on demand with chrome.scripting into the tab the user activated, so
// the extension never reads pages the user has not asked about. What it reads
// stays in this tab and the open panel: no storage, no network, no page HTML.

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

declare global {
  interface Window {
    /** Isolated-world marker, so repeated activation does not add a second listener. */
    formSaathiReader?: { rescan: () => void };
  }
}

/** Controls that carry secrets. Their values are never collected, only counted. */
const SENSITIVE_LATIN =
  /\b(otp|one\s?time|captcha|pass\s?word|passwd|pass\s?code|cvv|cvc|cc\s(number|csc|exp)|card\s?number|security\s?code)\b/i;
// Devanagari has no ASCII word boundaries, so these terms are matched on their own.
const SENSITIVE_HINDI = /(ओटीपी|कैप्चा|पासवर्ड|गुप्त\s?शब्द|सुरक्षा\s?कोड)/;
/** Buttons and hidden inputs are not fields a person fills in. */
const IGNORED_TYPES = new Set(['button', 'image', 'reset', 'submit', 'hidden']);
/** Real controls this reader does not understand well enough to review. */
const UNSUPPORTED_TYPES = new Set(['file', 'color', 'range']);
const CUSTOM_WIDGETS = '[contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="spinbutton"]';

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function textFromIds(ids: string | null): string {
  if (!ids) return '';
  return clean(ids.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' '));
}

function labelOf(element: Element): string {
  const labelled = textFromIds(element.getAttribute('aria-labelledby'));
  if (labelled) return labelled;
  const ariaLabel = clean(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;
  if ('labels' in element) {
    const labels = (element as FormControl).labels;
    if (labels && labels.length > 0) return clean([...labels].map((label) => label.textContent).join(' '));
  }
  return clean(element.getAttribute('title')) || clean(element.getAttribute('placeholder'));
}

function describe(element: Element): string {
  return labelOf(element)
    || clean(element.getAttribute('name'))
    || clean(element.getAttribute('id'))
    || element.tagName.toLowerCase();
}

/** Language tags only: page text goes into a `lang` attribute, so keep it plain. */
const LANGUAGE_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

function langOf(element: Element): string {
  const declared = clean(element.closest('[lang]')?.getAttribute('lang'));
  return LANGUAGE_TAG.test(declared) ? declared : '';
}

function groupOf(element: Element): string {
  const legend = element.closest('fieldset')?.querySelector(':scope > legend');
  return clean(legend?.textContent);
}

const identifiers = new WeakMap<Element, string>();
let nextIdentifier = 0;

/** Stable for as long as the element lives, so the panel can keep its place. */
function identify(element: Element): string {
  const existing = identifiers.get(element);
  if (existing) return existing;
  nextIdentifier += 1;
  const identifier = `f${nextIdentifier}`;
  identifiers.set(element, identifier);
  return identifier;
}

function isSensitive(control: FormControl): boolean {
  if (control instanceof HTMLInputElement && control.type === 'password') return true;
  // Check all label sources, even when an innocuous aria-label takes priority
  // for display. No values or options are touched at this boundary.
  const metadata = [
    control.name, control.id, control.getAttribute('autocomplete'), labelOf(control),
    control.getAttribute('aria-label'), control.getAttribute('title'), control.getAttribute('placeholder'),
    groupOf(control), ...[...control.labels ?? []].map((label) => label.textContent),
  ];
  return metadata.some((text) => {
    const words = (text ?? '').normalize('NFKC')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\s-]+/g, ' ');
    return SENSITIVE_LATIN.test(words) || SENSITIVE_HINDI.test(words);
  });
}

function controlType(control: FormControl): string {
  if (control instanceof HTMLInputElement) return control.type;
  if (control instanceof HTMLSelectElement) return control.multiple ? 'select-multiple' : 'select';
  return 'textarea';
}

function kindOf(control: FormControl): FormField['kind'] {
  if (control instanceof HTMLSelectElement) return 'select';
  if (control instanceof HTMLTextAreaElement) return 'textarea';
  return control.type === 'checkbox' ? 'checkbox' : 'text';
}

function isActive(control: Element): boolean {
  return control.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
    && !control.matches(':disabled');
}

function constraintsOf(control: FormControl): FormField['constraints'] {
  const input = control instanceof HTMLInputElement ? control : null;
  const length = 'maxLength' in control ? control.maxLength : -1;
  return {
    control: controlType(control),
    pattern: input?.pattern || null,
    inputMode: control.getAttribute('inputmode'),
    maxLength: length >= 0 ? length : null,
    min: input?.min || null,
    max: input?.max || null,
  };
}

/** The form element that owns a control, as a stable identifier; empty outside any form. */
function formOf(control: FormControl): string {
  return control.form ? identify(control.form) : '';
}

/**
 * The choices a page offers, which explain a field. An inactive control keeps
 * its option labels and values, never which one the person had chosen.
 */
function optionsOf(control: FormControl, active: boolean): FormField['options'] {
  if (control instanceof HTMLSelectElement) {
    return [...control.options].map((option) => ({
      value: option.value,
      label: clean(option.textContent) || option.value,
      selected: active && option.selected,
    }));
  }
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return [{ value: control.value, label: labelOf(control), selected: active && control.checked }];
  }
  return [];
}

function readField(control: FormControl, target: Map<string, HTMLElement>): FormField {
  const fieldId = identify(control);
  const active = isActive(control);
  target.set(fieldId, control);
  return {
    fieldId,
    form: formOf(control),
    key: control.name || control.id,
    kind: kindOf(control),
    label: labelOf(control),
    description: textFromIds(control.getAttribute('aria-describedby')),
    group: groupOf(control),
    lang: langOf(control),
    // A hidden or disabled conditional field is listed, but its leftover value is not.
    status: active ? 'read' : 'inactive',
    required: control.required,
    readOnly: 'readOnly' in control ? control.readOnly : false,
    value: active ? readValue(control) : null,
    options: optionsOf(control, active),
    constraints: constraintsOf(control),
  };
}

function readValue(control: FormControl): string {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return control.checked ? control.value || 'checked' : '';
  }
  return control.value;
}

function readRadioGroup(members: HTMLInputElement[], target: Map<string, HTMLElement>): FormField {
  const first = members[0]!;
  const checked = members.find((member) => member.checked);
  const fieldId = identify(first);
  const active = members.some(isActive);
  const parent = first.closest('fieldset')?.parentElement;
  // Focus follows the native tab order: the chosen radio, otherwise the first one.
  target.set(fieldId, checked ?? first);
  return {
    fieldId,
    form: formOf(first),
    key: first.name || first.id,
    kind: 'radio-group',
    label: groupOf(first) || labelOf(first),
    description: textFromIds(first.getAttribute('aria-describedby')),
    // The group's own legend is the label, so the group name comes from the section above it.
    group: parent ? groupOf(parent) : '',
    lang: langOf(first),
    status: active ? 'read' : 'inactive',
    required: members.some((member) => member.required),
    readOnly: false,
    value: active ? checked?.value ?? '' : null,
    options: members.map((member) => ({
      value: member.value,
      label: labelOf(member) || member.value,
      selected: active && member.checked,
    })),
    constraints: { control: 'radio', pattern: null, inputMode: null, maxLength: null, min: null, max: null },
  };
}

export default defineUnlistedScript(() => {
  if (window.formSaathiReader) {
    window.formSaathiReader.rescan();
    return;
  }

  // Identifies this document instance only; a reload produces a new one and the
  // panel drops its earlier review. Not a security token.
  const documentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const targets = new Map<string, HTMLElement>();
  let boundTabId: number | null = null;
  let sequence = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let observer: MutationObserver | undefined;

  function capture(tabId: number): FormSnapshot {
    targets.clear();
    const fields: FormField[] = [];
    const gaps: CoverageGap[] = [];
    const grouped = new Set<HTMLInputElement>();
    const controls = [...document.querySelectorAll<FormControl>('input, select, textarea')];

    for (const control of controls) {
      const type = controlType(control);
      if (IGNORED_TYPES.has(type)) continue;
      if (control instanceof HTMLInputElement && type === 'radio') {
        if (grouped.has(control)) continue;
        // Native form ownership also includes radios outside their form; an
        // unnamed radio is independent. Inspect every member before reading any.
        // ponytail: scan controls per group; index by form/name if a portal is large.
        const members = control.name === '' ? [control] : controls.filter((member): member is HTMLInputElement => (
          member instanceof HTMLInputElement && member.type === 'radio'
          && member.name === control.name && member.form === control.form
        ));
        for (const member of members) grouped.add(member);
        const sensitive = members.filter(isSensitive);
        if (sensitive.length > 0) {
          for (const member of sensitive) gaps.push({ reason: 'sensitive', label: describe(member) });
          continue;
        }
        fields.push(readRadioGroup(members, targets));
        continue;
      }
      if (isSensitive(control)) {
        gaps.push({ reason: 'sensitive', label: describe(control) });
        continue;
      }
      if (UNSUPPORTED_TYPES.has(type)) {
        gaps.push({ reason: 'unsupported-control', label: describe(control) });
        continue;
      }
      fields.push(readField(control, targets));
    }

    // ponytail: top frame only. Frames are reported as gaps instead of being
    // read; add per-frame injection when a live portal actually needs it.
    for (const frame of document.querySelectorAll('iframe, frame')) {
      gaps.push({ reason: 'frame', label: describe(frame) });
    }
    for (const widget of document.querySelectorAll(CUSTOM_WIDGETS)) {
      if (widget instanceof HTMLInputElement || widget instanceof HTMLSelectElement
        || widget instanceof HTMLTextAreaElement) continue;
      gaps.push({ reason: 'unsupported-control', label: describe(widget) });
    }

    sequence += 1;
    return {
      tabId,
      documentId,
      sequence,
      origin: location.origin,
      title: document.title,
      fields,
      gaps,
    };
  }

  let lastDigest = '';

  /**
   * What was last sent, as the panel's own review sees it: labels,
   * instructions, values, options, constraints, states and gaps, plus the
   * title, and the identity of every control and its form. A control replaced
   * by an identical one is a new focus target the panel must learn about,
   * while sequence and timing are left out, so an unchanged page is not
   * re-announced and does not invalidate an acknowledgment.
   */
  function digestOf(snapshot: FormSnapshot): string {
    const identity = snapshot.fields.map((field) => `${field.fieldId}/${field.form}`).join(' ');
    return `${snapshot.title}\n${identity}\n${snapshotRevision(snapshot.fields, snapshot.gaps)}`;
  }

  function send(reply: ReaderReply): void {
    if (reply.type === 'snapshot') lastDigest = digestOf(reply.snapshot);
    // The panel may be closed; a missing receiver is not a failure here.
    void chrome.runtime.sendMessage(reply).catch(() => undefined);
  }

  /** Re-reads the form and pushes it only if something the review uses differs. */
  function pushIfChanged(): void {
    if (boundTabId === null) return;
    const snapshot = capture(boundTabId);
    if (digestOf(snapshot) !== lastDigest) send({ type: 'snapshot', snapshot });
  }

  function queueUpdate(): void {
    if (boundTabId === null || pending !== undefined) return;
    pending = setTimeout(() => {
      pending = undefined;
      pushIfChanged();
    }, 250);
  }

  function watch(): void {
    if (observer) return;
    // Any attribute, text or structure change may alter a label, instruction,
    // option, constraint or visibility, so all of them queue one debounced
    // re-read that is compared before it is sent.
    // ponytail: a full capture per 250 ms burst; filter by target if a portal is large.
    observer = new MutationObserver(queueUpdate);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    // `input` as well as `change`: a value being typed is what the panel must show.
    document.addEventListener('input', queueUpdate, true);
    document.addEventListener('change', queueUpdate, true);
    // Scripts can set values without any event or attribute change, so the
    // form is also re-read on a timer and pushed only when it differs.
    // ponytail: a full capture every 3 s; diff by element if a portal is large.
    setInterval(() => {
      if (pending === undefined) pushIfChanged();
    }, 3000);
  }

  function focusField(fieldId: string): 'focused' | 'missing' {
    const element = targets.get(fieldId);
    if (!element?.isConnected) return 'missing';
    element.focus();
    element.scrollIntoView({ block: 'center' });
    return document.activeElement === element ? 'focused' : 'missing';
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const request = readerRequestSchema.safeParse(message);
    if (!request.success) return;
    if (request.data.type === 'scan') {
      boundTabId = request.data.tabId;
      watch();
      const snapshot = capture(boundTabId);
      lastDigest = digestOf(snapshot);
      sendResponse({ type: 'snapshot', snapshot } satisfies ReaderReply);
      return;
    }
    const { documentId: requested, fieldId } = request.data;
    sendResponse({
      type: 'focus-result',
      documentId,
      fieldId,
      result: requested === documentId ? focusField(fieldId) : 'stale',
    } satisfies ReaderReply);
  });

  window.formSaathiReader = { rescan: queueUpdate };
});
