// Versioned rule packs. A pack records what a reviewed source says about a
// workflow's fields. Matching a pack never means the workflow was verified
// against the live portal: every pack here is still `liveTesting: 'unverified'`.

export const livePortalSupport = {
  nsp: 'unverified',
  eciForm6: 'unverified',
} as const;

export type Workflow = keyof typeof livePortalSupport;

/**
 * What a mapped control means. Only a reviewed mapping may select an identifier
 * check: a number is never classified by looking at it.
 */
export type FieldMeaning =
  | 'english-name'
  | 'hindi-name'
  | 'gender'
  | 'date-of-birth'
  | 'address'
  | 'district'
  | 'state'
  | 'postal-pin'
  | 'locality-type'
  | 'locality-detail'
  | 'age-document'
  | 'age-document-name'
  | 'email'
  | 'nsp-otr'
  | 'aadhaar'
  | 'aadhaar-eid'
  | 'ifsc'
  | 'unknown';

export type FieldRule = {
  /** The control's own name or id, as recorded in the field inventory. */
  key: string;
  meaning: FieldMeaning;
  /** `read-only` fields are corrected upstream, never in this form. */
  requirement: 'required' | 'optional' | 'conditional' | 'read-only';
  /** Source register id, or a fixture assumption id, behind this mapping. */
  source: string;
  /** Required only while this control holds this value. */
  when?: { key: string; value: string };
};

export type RulePack = {
  id: string;
  version: string;
  reviewed: string;
  liveTesting: 'unverified' | 'verified';
  workflow: Workflow;
  /** Live hosts this pack describes. Matching one does not verify anything. */
  hosts: readonly string[];
  /**
   * Control keys that identify this workflow's practice representation. A page
   * without all of them, on any host, is not this workflow.
   */
  signature: readonly string[];
  fields: readonly FieldRule[];
};

/**
 * Field keys are the practice inventory's ids (docs/support-matrix.md). The
 * live portals' own control names are still unknown, so on a live host this
 * pack is selected only if the page happens to carry these keys, and its
 * mappings remain unverified there.
 */
export const nspPack: RulePack = {
  id: 'nsp-2026-27-basic-general',
  version: '1.0',
  reviewed: '2026-09-12',
  liveTesting: 'unverified',
  workflow: 'nsp',
  hosts: ['scholarships.gov.in'],
  signature: ['nsp-otr', 'nsp-locality'],
  fields: [
    { key: 'nsp-name', meaning: 'english-name', requirement: 'read-only', source: 'N2' },
    { key: 'nsp-dob', meaning: 'date-of-birth', requirement: 'read-only', source: 'N2' },
    { key: 'nsp-gender', meaning: 'gender', requirement: 'read-only', source: 'N2' },
    { key: 'nsp-state', meaning: 'state', requirement: 'read-only', source: 'N3' },
    { key: 'nsp-district', meaning: 'district', requirement: 'required', source: 'N3/F1' },
    { key: 'nsp-address', meaning: 'address', requirement: 'required', source: 'N3/F1' },
    { key: 'nsp-pin', meaning: 'postal-pin', requirement: 'required', source: 'F1/F3' },
    { key: 'nsp-locality', meaning: 'locality-type', requirement: 'required', source: 'N3/F1' },
    {
      key: 'nsp-locality-other',
      meaning: 'locality-detail',
      requirement: 'conditional',
      when: { key: 'nsp-locality', value: 'other' },
      source: 'F4',
    },
    { key: 'nsp-otr', meaning: 'nsp-otr', requirement: 'required', source: 'N1/F5' },
    // Deliberately unclear label: its digits identify nothing.
    { key: 'nsp-detail', meaning: 'unknown', requirement: 'optional', source: 'F6' },
    { key: 'nsp-note', meaning: 'unknown', requirement: 'optional', source: 'F7' },
  ],
};

export const eciPack: RulePack = {
  id: 'eci-form6-new-voter',
  version: '1.0',
  reviewed: '2026-09-12',
  liveTesting: 'unverified',
  workflow: 'eciForm6',
  hosts: ['voters.eci.gov.in'],
  signature: ['eci-name-hi', 'eci-age-proof'],
  fields: [
    { key: 'eci-name-hi', meaning: 'hindi-name', requirement: 'required', source: 'E1 मद 1/F9' },
    // E2 allows one language, so a blank English name is not missing information.
    { key: 'eci-name-en', meaning: 'english-name', requirement: 'optional', source: 'E2 खंड 2' },
    { key: 'eci-gender', meaning: 'gender', requirement: 'required', source: 'E2 खंड 5' },
    { key: 'eci-dob', meaning: 'date-of-birth', requirement: 'required', source: 'E1 मद 7' },
    { key: 'eci-age-proof', meaning: 'age-document', requirement: 'required', source: 'E1 मद 7' },
    {
      key: 'eci-age-proof-other',
      meaning: 'age-document-name',
      requirement: 'conditional',
      when: { key: 'eci-age-proof', value: 'other' },
      source: 'E1 मद 7(ii)',
    },
    { key: 'eci-address', meaning: 'address', requirement: 'required', source: 'E1 मद 8' },
    { key: 'eci-district', meaning: 'district', requirement: 'required', source: 'E1 मद 8' },
    { key: 'eci-state', meaning: 'state', requirement: 'required', source: 'E1 मद 8' },
    { key: 'eci-pin', meaning: 'postal-pin', requirement: 'required', source: 'E2 खंड 7/F3' },
    { key: 'eci-email', meaning: 'email', requirement: 'optional', source: 'E1 मद 4' },
    { key: 'eci-detail', meaning: 'unknown', requirement: 'optional', source: 'F6' },
    { key: 'eci-note', meaning: 'unknown', requirement: 'optional', source: 'F7' },
  ],
};

export const rulePacks: readonly RulePack[] = [nspPack, eciPack];

export type PageRecognition =
  | { kind: 'portal'; workflow: Workflow }
  | { kind: 'local' }
  | { kind: 'unknown' };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const ORIGIN_HOST = /^[a-z][a-z0-9+.-]*:\/\/(\[[0-9a-f:]+\]|[^/:]+)/i;

/**
 * Host recognition only. It says which workflow a page may belong to; it never
 * establishes that the workflow is supported or that any page was verified.
 */
export function recognizePage(origin: string): PageRecognition {
  // Read the host directly: this package carries no DOM or Node types, and an
  // opaque origin such as `null` simply has none.
  const host = ORIGIN_HOST.exec(origin)?.[1]?.toLowerCase();
  if (host === undefined) return { kind: 'unknown' };
  if (LOCAL_HOSTS.has(host)) return { kind: 'local' };
  for (const pack of rulePacks) {
    if (pack.hosts.some((portal) => host === portal || host.endsWith(`.${portal}`))) {
      return { kind: 'portal', workflow: pack.workflow };
    }
  }
  return { kind: 'unknown' };
}

export type PackSelection =
  | { pack: RulePack; via: 'host' | 'practice'; missing: readonly FieldRule[] }
  /** Recognised as a portal or practice page, but not as any reviewed workflow. */
  | { pack: null; reason: 'no-fields' | 'no-workflow' | 'unknown-page' };

/**
 * A pack applies only to a page that carries its workflow's signature fields.
 * The host says which portal a page belongs to, never which form it is: an
 * unrelated or empty portal page selects nothing. A local page is matched the
 * same way, by its practice field keys. `missing` lists the pack's non-optional
 * fields the page did not offer, so coverage is reported instead of assumed.
 */
export function selectRulePack(origin: string, keys: readonly string[]): PackSelection {
  const page = recognizePage(origin);
  if (page.kind === 'unknown') return { pack: null, reason: 'unknown-page' };
  if (keys.length === 0) return { pack: null, reason: 'no-fields' };
  const candidates = page.kind === 'portal'
    ? rulePacks.filter((candidate) => candidate.workflow === page.workflow)
    : rulePacks;
  const pack = candidates.find((candidate) => candidate.signature.every((key) => keys.includes(key)));
  // A local page without a practice signature is simply a page no pack describes.
  if (!pack) return { pack: null, reason: page.kind === 'portal' ? 'no-workflow' : 'unknown-page' };
  return {
    pack,
    via: page.kind === 'portal' ? 'host' : 'practice',
    missing: pack.fields.filter((rule) => rule.requirement !== 'optional' && !keys.includes(rule.key)),
  };
}
