import type { FormField } from '@form-saathi/contracts';

// Where the person's current field went when a new snapshot no longer carries
// its identifier: the page replaced the control with an equivalent one, or
// removed it. Pure, so the rule that a guessed control is never focused can be
// tested without a browser.

export type Relocation =
  | { fieldId: string; reason: null }
  | { fieldId: null; reason: 'ambiguous' | 'removed' };

/**
 * Matches by the owning form and the reviewed metadata. Within a form that is
 * still there only that form counts, so a same-named control in another form
 * is never taken for the lost one; a form re-rendered whole has a new identity,
 * so only forms that did not exist before may stand in for it. Among controls
 * identical in every respect the place in document order decides, and only
 * while their number is unchanged; otherwise no candidate is unambiguous and
 * none is chosen.
 */
export function relocate(previous: readonly FormField[], fieldId: string, next: readonly FormField[]): Relocation {
  const lost = previous.find((field) => field.fieldId === fieldId);
  if (!lost) return { fieldId: null, reason: 'removed' };
  const alike = (field: FormField) => field.key === lost.key && field.kind === lost.kind
    && field.label === lost.label && field.group === lost.group;
  const formSurvived = next.some((field) => field.form === lost.form);
  const known = new Set(previous.map((field) => field.form));
  const eligible = (field: FormField) => (formSurvived ? field.form === lost.form : !known.has(field.form));
  const before = previous.filter((field) => alike(field) && field.form === lost.form);
  const after = next.filter((field) => alike(field) && eligible(field));
  if (after.length === 0) return { fieldId: null, reason: 'removed' };
  if (after.length !== before.length) return { fieldId: null, reason: 'ambiguous' };
  return { fieldId: after[before.indexOf(lost)]!.fieldId, reason: null };
}
