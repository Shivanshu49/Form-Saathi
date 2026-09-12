// Browser-safe workflow knowledge and the local validation engine. Nothing here
// contacts a service, and no check claims eligibility, identity or acceptance.

import type { RulePack } from './packs.js';

export * from './packs.js';
export * from './review.js';
export * from './validate.js';

/** Eight or more digits: long enough to be an identifier worth hiding by default. */
const IDENTIFIER = /^\d{8,}$/;

/**
 * Hides long identifiers such as OTR or unexplained numbers until the person
 * asks for them. Dates and postal codes stay readable, and masking classifies
 * nothing: a masked value is not a claim about what the number is.
 */
export function maskIdentifier(value: string): { masked: boolean; text: string } {
  const digits = value.replace(/[\s-]/g, '');
  if (!IDENTIFIER.test(digits)) return { masked: false, text: value };
  return { masked: true, text: `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}` };
}

const IDENTIFIER_MEANINGS = new Set(['nsp-otr', 'aadhaar', 'aadhaar-eid', 'ifsc']);

export type SpeechEligibility =
  | { allowed: true }
  | { allowed: false; reason: 'inactive' | 'read-only' | 'identifier' };

/**
 * Whether a field may take a spoken value through the cloud. Read-only fields
 * cannot change here, and identifiers — by reviewed meaning or by looking like
 * one — are never recorded, because audio cannot be redacted before it is sent.
 */
export function speechEligibility(
  field: { key: string; status: string; readOnly: boolean; value: string | null },
  pack: RulePack | null,
): SpeechEligibility {
  if (field.status !== 'read') return { allowed: false, reason: 'inactive' };
  if (field.readOnly) return { allowed: false, reason: 'read-only' };
  const meaning = pack?.fields.find((rule) => rule.key === field.key)?.meaning;
  if (meaning !== undefined && IDENTIFIER_MEANINGS.has(meaning)) return { allowed: false, reason: 'identifier' };
  if (field.value !== null && maskIdentifier(field.value).masked) return { allowed: false, reason: 'identifier' };
  return { allowed: true };
}
