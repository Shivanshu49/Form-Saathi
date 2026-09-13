'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isLocale, localeDirection, localeNames, localeOrEnglish, locales, translator, type Locale } from '@form-saathi/contracts';

export const LOCALE_STORAGE_KEY = 'form-saathi.locale';
type Preference = { read: () => Promise<unknown>; write: (locale: Locale) => Promise<void> };
const webPreference: Preference = {
  read: async () => localStorage.getItem(LOCALE_STORAGE_KEY),
  write: async (locale) => { localStorage.setItem(LOCALE_STORAGE_KEY, locale); },
};
const LocaleContext = createContext({ locale: 'en' as Locale, setLocale: (_locale: Locale) => {}, t: translator() });

export function LocaleProvider({ children, preference = webPreference }: { children: ReactNode; preference?: Preference }) {
  const [locale, setValue] = useState<Locale>('en');
  const chosen = useRef(false);
  useEffect(() => {
    let mounted = true;
    void preference.read().then((stored) => { if (mounted && !chosen.current) setValue(localeOrEnglish(stored)); }).catch(() => {});
    return () => { mounted = false; };
  }, [preference]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
    document.title = translator(locale)('app.name');
    document.querySelector('meta[name="description"]')?.setAttribute('content', translator(locale)('app.description'));
  }, [locale]);
  function setLocale(next: Locale) {
    if (!isLocale(next)) return;
    chosen.current = true;
    setValue(next);
    void preference.write(next).catch(() => {});
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: translator(locale) }}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
export function LanguageSelect() {
  const { locale, setLocale, t } = useLocale();
  return <label className="language-control"><span className="sr-only">{t('language')}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} dir="auto">
    {locales.map((item) => <option key={item} value={item} lang={item} dir={localeDirection(item)}>{localeNames[item]}</option>)}
  </select></label>;
}
