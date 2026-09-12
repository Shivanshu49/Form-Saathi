import { profiles } from './profiles.js';

const form = document.querySelector<HTMLFormElement>('#practice-form');
const variantSelect = document.querySelector<HTMLSelectElement>('#variant');
const scenarioSelect = document.querySelector<HTMLSelectElement>('#scenario');
const status = document.querySelector<HTMLOutputElement>('#practice-status');
const reference = document.querySelector<HTMLElement>('#reference-name');
const conditional = document.querySelector<HTMLFieldSetElement>('#conditional-fields');
const workflow = document.body.dataset.workflow;
if (!form || !variantSelect || !scenarioSelect || !status || !reference || !conditional
  || (workflow !== 'nsp' && workflow !== 'eci')) {
  throw new Error('Practice page is missing its required controls.');
}

const query = new URLSearchParams(location.search);
const variant = query.get('variant') === 'b' ? 'b' : 'a';
const scenario = query.get('case') === 'complete' ? 'complete' : 'issues';
const profile = profiles[workflow][variant];
const values: Record<string, string> = scenario === 'complete'
  ? profile.complete : { ...profile.complete, ...profile.issues };
variantSelect.value = variant;
scenarioSelect.value = scenario;
reference.textContent = profile.reference;
document.querySelector('#profile-label')!.textContent =
  `प्रोफ़ाइल ${variant.toUpperCase()} · ${scenario === 'issues' ? 'सुधार का अभ्यास' : 'भरे हुए उदाहरण'}`;

for (const control of form.querySelectorAll('input, select')) {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) continue;
  const value = values[control.name];
  if (value === undefined) continue;
  if (control instanceof HTMLInputElement && control.type === 'radio') {
    control.checked = control.value === value;
  } else {
    control.value = value;
  }
}

const conditionalRadioName = workflow === 'nsp' ? 'nsp-locality' : 'eci-age-proof';
function syncConditional() {
  const selected = form!.querySelector<HTMLInputElement>(`input[name="${conditionalRadioName}"]:checked`);
  const active = selected?.value === 'other';
  conditional!.hidden = !active;
  conditional!.disabled = !active;
}
syncConditional();
form.addEventListener('change', syncConditional);

document.querySelector('#load-profile')!.addEventListener('click', () => {
  // Reload explicitly; only profile selectors enter the URL, never typed form values.
  const search = new URLSearchParams({ variant: variantSelect.value, case: scenarioSelect.value });
  location.search = search.toString();
});
document.querySelector('#reset-profile')!.addEventListener('click', () => location.reload());

const addNote = document.querySelector<HTMLButtonElement>('#add-note')!;
addNote.addEventListener('click', () => {
  if (addNote.getAttribute('aria-expanded') === 'true') return;
  const template = document.querySelector<HTMLTemplateElement>('#note-template')!;
  document.querySelector('#dynamic-fields')!.append(template.content.cloneNode(true));
  addNote.setAttribute('aria-expanded', 'true');
  addNote.setAttribute('aria-disabled', 'true');
  status.textContent = 'अतिरिक्त अभ्यास फ़ील्ड जुड़ गया। अगला Tab दबाकर वहाँ जाएँ।';
});

// This guard belongs only to these fictional forms, never to a portal Submit button.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  status.textContent = 'यह अभ्यास पृष्ठ है। कोई आवेदन नहीं भेजा जाता।';
});
