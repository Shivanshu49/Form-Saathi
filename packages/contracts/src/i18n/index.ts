import { web } from './web.js';
import { ui } from './ui.js';
import { speech } from './speech.js';
import { validation } from './validation.js';
import { errors } from './errors.js';

export const locales = ['en', 'hi', 'es', 'fr', 'ar'] as const;
export type Locale = typeof locales[number];
export const localeNames: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', es: 'Español', fr: 'Français', ar: 'العربية' };
export const messages = { ...ui, ...speech, ...validation, ...errors, ...web };
export type MessageKey = keyof typeof messages;
export type MessageParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: MessageParams) => string;
export const localeDirection = (locale: Locale) => locale === 'ar' ? 'rtl' : 'ltr';
export const isLocale = (value: unknown): value is Locale => locales.some((locale) => locale === value);
export const localeOrEnglish = (value: unknown): Locale => isLocale(value) ? value : 'en';

/** Interpolate only the authored template. Never rewrite interpolated source data. */
export function translator(locale: Locale = 'en'): Translator {
  return (key, params = {}) => messages[key][locales.indexOf(locale)]!.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Generated prose only. Never apply to values, references, URLs or source instructions. */
export const displayExplanation = (text: string): string => text.replace(/\s*[\u2013\u2014]\s*/g, ', ');

export type CloudLocale = 'en' | 'hi';
// Capability floor for the configured Sarvam adapter. Other UI locales never fall back.
export const speechCapabilities = {
  en: { transcription: 'en-IN', interpretation: 'en', speechOutput: 'en-IN', localVoice: 'en' },
  hi: { transcription: 'hi-IN', interpretation: 'hi', speechOutput: 'hi-IN', localVoice: 'hi' },
  es: { transcription: null, interpretation: null, speechOutput: null, localVoice: 'es' },
  fr: { transcription: null, interpretation: null, speechOutput: null, localVoice: 'fr' },
  ar: { transcription: null, interpretation: null, speechOutput: null, localVoice: 'ar' },
} as const;
