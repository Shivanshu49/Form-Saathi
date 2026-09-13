import { translator, type Translator, type FormField } from '@form-saathi/contracts';
import { maskIdentifier } from '@form-saathi/rules';

// How a field is described to a person, shared by the card, the list and the
// review. Values are masked until the person asks, everywhere alike.



/** Values are masked until the person asks, so nothing long is exposed by default. */
export function fieldValue(field: FormField, revealed: boolean, t: Translator = translator()): { prefix: string; value: string | null; maskable: boolean } {
  if (field.status === 'inactive') {
    return { prefix: t('value.inactive'), value: null, maskable: false };
  }
  if (field.kind === 'checkbox') {
    return { prefix: field.value ? t('value.checked') : t('value.unchecked'), value: null, maskable: false };
  }
  if (field.kind === 'radio-group' || field.kind === 'select') {
    const chosen = field.options.find((option) => option.selected);
    return field.value
      ? { prefix: t('value.selected'), value: chosen?.label ?? field.value, maskable: false }
      : { prefix: t('value.noChoice'), value: null, maskable: false };
  }
  if (!field.value) return { prefix: t('value.empty'), value: null, maskable: false };
  const { masked, text } = maskIdentifier(field.value);
  if (masked && !revealed) return { prefix: t('value.masked'), value: text, maskable: true };
  return { prefix: t('value.label'), value: field.value, maskable: masked };
}

export function metaText(field: FormField, t: Translator = translator()): string {
  return [field.required ? t('required') : t('optional'), field.readOnly ? t('read-only') : null]
    .filter((part) => part !== null).join(' · ');
}

export function spokenText(field: FormField, revealed: boolean, t: Translator = translator()): string {
  const value = fieldValue(field, revealed, t);
  const parts = [field.label || t('field.unlabelled'), metaText(field, t), `${value.prefix} ${value.value ?? ''}`.trim()];
  if (value.maskable && !revealed) parts.push(t('value.revealFirst'));
  if (field.description) parts.push(field.description);
  return parts.join('. ');
}
