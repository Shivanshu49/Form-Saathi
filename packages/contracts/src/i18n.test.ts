import { describe, expect, it } from 'vitest';
import { displayExplanation, isLocale, localeOrEnglish, locales, messages, speechCapabilities, translator } from './i18n/index.js';
import { cloudLocaleSchema } from './api.js';

describe('localization contract', () => {
  it('defaults only to English and accepts only explicit supported preferences', () => {
    for (const unknown of [undefined, null, '', 'hi-IN', 'fr-FR', '<script>']) expect(localeOrEnglish(unknown)).toBe('en');
    for (const locale of locales) { expect(isLocale(locale)).toBe(true); expect(localeOrEnglish(locale)).toBe(locale); }
  });
  it('has five complete translations with matching interpolation and no decorative dashes', () => {
    const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [key, translations] of Object.entries(messages)) {
      expect(translations, key).toHaveLength(5);
      for (const text of translations) {
        expect(text.trim().length, key).toBeGreaterThan(0);
        expect(text, key).not.toMatch(/[\u2013\u2014]/u);
        expect(parameters(text), key).toEqual(parameters(translations[0]));
      }
    }
  });
  it('changes only generated prose, never interpolated values or reference spelling', () => {
    const value = 'A–B—C https://example.org/2026–27';
    for (const locale of locales) expect(translator(locale)('v.nameMismatch', { label: 'Name', value, wanted: value })).toContain(value);
    expect(displayExplanation('Check this — then continue–carefully.')).toBe('Check this, then continue, carefully.');
  });
  it('maps UI language separately from cloud and local speech, with no silent fallback', () => {
    expect(speechCapabilities.en.transcription).toBe('en-IN');
    expect(speechCapabilities.hi.transcription).toBe('hi-IN');
    expect(cloudLocaleSchema.parse(undefined)).toBe('en');
    for (const locale of ['es', 'fr', 'ar'] as const) {
      expect(speechCapabilities[locale]).toEqual({ transcription: null, interpretation: null, speechOutput: null, localVoice: locale });
      expect(cloudLocaleSchema.safeParse(locale).success).toBe(false);
    }
  });
});
