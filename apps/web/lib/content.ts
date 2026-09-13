import { livePortalSupport, rulePacks } from '@form-saathi/rules';
import { profiles } from '../../../fixtures/profiles';
export const packs = rulePacks;
export { livePortalSupport, profiles };
export const PRACTICE_ORIGIN = process.env['NEXT_PUBLIC_PRACTICE_ORIGIN'] ?? 'http://127.0.0.1:4173';
export const practiceForms = [
  { workflow: 'nsp', profile: 'nsp', page: 'nsp.html' },
  { workflow: 'eciForm6', profile: 'eci', page: 'eci-form6.html' },
] as const;
export function practiceUrl(page: string, variant: 'a' | 'b', scenario: 'issues' | 'complete'): string {
  return `${PRACTICE_ORIGIN}/${page}?variant=${variant}&case=${scenario}`;
}
