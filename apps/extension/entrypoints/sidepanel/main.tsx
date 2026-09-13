import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocaleProvider, LOCALE_STORAGE_KEY } from '../../../../packages/ui/Locale';
import './style.css';

const preference = {
  read: async () => (await chrome.storage.local.get(LOCALE_STORAGE_KEY))[LOCALE_STORAGE_KEY],
  write: async (locale: string) => { await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: locale }); },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider preference={preference}><App /></LocaleProvider>
  </StrictMode>,
);
