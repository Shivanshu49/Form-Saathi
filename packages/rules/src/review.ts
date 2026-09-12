import type { ValidationResult } from './validate.js';

// The final review: which data an acknowledgment refers to, and what the
// results add up to. Nothing here claims acceptance, identity or submission.

/** Everything that, if it changes, makes an earlier acknowledgment stale. */
export type ReviewMaterial = {
  documentId: string;
  fields: readonly {
    key: string;
    label: string;
    group: string;
    kind: string;
    status: string;
    required: boolean;
    readOnly: boolean;
    value: string | null;
    options: readonly { value: string; selected: boolean }[];
  }[];
  gaps: readonly { reason: string; label: string }[];
  pack: { id: string; version: string; reviewed: string } | null;
  reference: string;
};

/**
 * A deterministic description of exactly what was reviewed. Compared as a
 * whole, so no two different states can share a revision.
 */
export function reviewRevision(material: ReviewMaterial): string {
  return JSON.stringify([
    material.documentId,
    material.pack ? [material.pack.id, material.pack.version, material.pack.reviewed] : null,
    material.reference,
    material.fields.map((field) => [
      field.key, field.label, field.group, field.kind, field.status, field.required, field.readOnly, field.value,
      field.options.filter((option) => option.selected).map((option) => option.value),
    ]),
    material.gaps.map((gap) => [gap.reason, gap.label]),
  ]);
}

/** A short label for a revision, for display only; comparison uses the full text. */
export function shortRevision(revision: string): string {
  let hash = 2166136261;
  for (const character of revision) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export type ReviewOutcome =
  | 'blocked'
  | 'corrections-pending'
  | 'confirmation-needed'
  | 'partial-coverage'
  | 'clear';

export type ReviewSummary = {
  outcome: ReviewOutcome;
  errors: number;
  confirmations: number;
  unchecked: number;
  /** Things only the person can deal with, on the portal or elsewhere. */
  blockers: string[];
  /** Limits that no amount of correction removes at this stage. */
  permanentLimits: number;
};

/** Never checked by design; they do not make coverage incomplete, only honest. */
const PERMANENT_LIMITS = new Set([
  'live-testing-unverified',
  'pin-district-unchecked',
  'otr-issuance-unchecked',
  'ifsc-branch-unchecked',
  'aadhaar-unchecked',
  'aadhaar-eid-unchecked',
]);

export function summarizeReview(
  results: readonly ValidationResult[],
  fields: readonly { fieldId: string; readOnly: boolean }[],
  gaps: readonly { reason: string; label: string }[],
): ReviewSummary {
  const errors = results.filter((result) => result.severity === 'error');
  const confirmations = results.filter((result) => result.severity === 'needs-confirmation');
  const unchecked = results.filter((result) => result.severity === 'unchecked');
  const readOnly = new Set(fields.filter((field) => field.readOnly).map((field) => field.fieldId));
  const blockers = [
    // Secrets and CAPTCHAs are never read: the person must handle them on the portal.
    ...gaps.filter((gap) => gap.reason === 'sensitive').map((gap) => gap.label),
    // A wrong read-only value cannot be corrected in this form at all.
    ...errors.filter((error) => error.fieldId !== null && readOnly.has(error.fieldId)).map((error) => error.message),
  ];
  const permanent = unchecked.filter((result) => PERMANENT_LIMITS.has(result.ruleId)).length;
  const incomplete = unchecked.length > permanent;
  const outcome: ReviewOutcome = blockers.length > 0
    ? 'blocked'
    : errors.length > 0
      ? 'corrections-pending'
      : confirmations.length > 0
        ? 'confirmation-needed'
        : incomplete
          ? 'partial-coverage'
          : 'clear';
  return {
    outcome,
    errors: errors.length,
    confirmations: confirmations.length,
    unchecked: unchecked.length,
    blockers,
    permanentLimits: permanent,
  };
}

export type AcknowledgmentState = 'none' | 'current' | 'stale';

/**
 * Whether an acknowledgment still describes what is on screen. It is current
 * only for the same document and the identical revision; a different revision
 * of the same document is stale, and another document has no acknowledgment.
 */
export function acknowledgmentState(
  acknowledged: { documentId: string; revision: string } | null,
  displayed: { documentId: string; revision: string } | null,
): AcknowledgmentState {
  if (acknowledged === null || displayed === null || acknowledged.documentId !== displayed.documentId) return 'none';
  return acknowledged.revision === displayed.revision ? 'current' : 'stale';
}
