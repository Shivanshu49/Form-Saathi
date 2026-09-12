import { livePortalSupport, rulePacks, type Workflow } from '@form-saathi/rules';
import { profiles } from '../../../fixtures/profiles';

// The website's only source of portal facts is the rules package. Nothing
// about hosts, fields, requirements or live status is restated here.

export const packs = rulePacks;
export { livePortalSupport, profiles };

export const workflowTitle: Record<Workflow, string> = {
  nsp: 'NSP — Basic Information → General Information (AY 2026–27)',
  eciForm6: 'ECI Form 6 — नए मतदाता का आवेदन',
};

export const supportText: Record<(typeof livePortalSupport)[Workflow], string> = {
  unverified: 'असत्यापित — वास्तविक पोर्टल पर परीक्षण बाकी है',
};

/** The practice pages live in the fixture build, served beside this site. */
export const PRACTICE_ORIGIN = process.env['NEXT_PUBLIC_PRACTICE_ORIGIN'] ?? 'http://127.0.0.1:4173';

export const practiceForms = [
  {
    workflow: 'nsp' as const,
    profile: 'nsp' as const,
    page: 'nsp.html',
    heading: 'NSP: सामान्य जानकारी',
    summary: 'इच्छित Basic Information → General Information चरण का सीमित अभ्यास। लॉगिन के बाद का लाइव फ़ॉर्म जाँचा नहीं गया है।',
  },
  {
    workflow: 'eciForm6' as const,
    profile: 'eci' as const,
    page: 'eci-form6.html',
    heading: 'Form 6: नाम, जन्म तारीख और पता',
    summary: 'प्रकाशित Form 6 के कुछ हिस्सों का अभ्यास। यह पूरा आवेदन या लाइव ऑनलाइन फ़ॉर्म की प्रतिलिपि नहीं है।',
  },
];

export function practiceUrl(page: string, variant: 'a' | 'b', scenario: 'issues' | 'complete'): string {
  return `${PRACTICE_ORIGIN}/${page}?variant=${variant}&case=${scenario}`;
}
