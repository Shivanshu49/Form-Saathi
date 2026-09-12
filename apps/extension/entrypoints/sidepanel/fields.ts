import type { FormField } from '@form-saathi/contracts';
import { maskIdentifier } from '@form-saathi/rules';

// How a field is described to a person, shared by the card, the list and the
// review. Values are masked until the person asks, everywhere alike.

export const noField = 'बिना लेबल का फ़ील्ड';

/** Values are masked until the person asks, so nothing long is exposed by default. */
export function fieldValue(field: FormField, revealed: boolean): { prefix: string; value: string | null; maskable: boolean } {
  if (field.status === 'inactive') {
    return { prefix: 'अभी लागू नहीं — यह फ़ील्ड छिपा या निष्क्रिय है।', value: null, maskable: false };
  }
  if (field.kind === 'checkbox') {
    return { prefix: field.value ? 'चुना गया।' : 'नहीं चुना गया।', value: null, maskable: false };
  }
  if (field.kind === 'radio-group' || field.kind === 'select') {
    const chosen = field.options.find((option) => option.selected);
    return field.value
      ? { prefix: 'चुना गया:', value: chosen?.label ?? field.value, maskable: false }
      : { prefix: 'कोई विकल्प नहीं चुना गया।', value: null, maskable: false };
  }
  if (!field.value) return { prefix: 'अभी खाली है।', value: null, maskable: false };
  const { masked, text } = maskIdentifier(field.value);
  if (masked && !revealed) return { prefix: 'मान छिपा है:', value: text, maskable: true };
  return { prefix: 'मान:', value: field.value, maskable: masked };
}

export function metaText(field: FormField): string {
  return [field.required ? 'आवश्यक' : 'वैकल्पिक', field.readOnly ? 'केवल पढ़ें' : null]
    .filter((part) => part !== null).join(' · ');
}

export function spokenText(field: FormField, revealed: boolean): string {
  const value = fieldValue(field, revealed);
  const parts = [field.label || noField, metaText(field), `${value.prefix} ${value.value ?? ''}`.trim()];
  if (value.maskable && !revealed) parts.push('पूरा मान सुनने के लिए पहले उसे दिखाएँ।');
  if (field.description) parts.push(field.description);
  return parts.join('। ');
}
