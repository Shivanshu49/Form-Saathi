import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { API_ORIGIN } from './config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifestVersion: 3,
  webExt: { disabled: true },
  dev: { server: { port: 5173, strictPort: true } },
  manifest: {
    name: 'Form Saathi',
    // sidePanel.open() needs 116. activeTab and scripting replace blanket host
    // access: the reader is injected only into the tab the user activates.
    minimum_chrome_version: '116',
    // tts: local voices for read-aloud, checked before use. storage: the
    // local area for explicit locale preference; session area for credential
    // and consent. Session data is cleared
    // when the browser closes and never written to disk.
    permissions: ['sidePanel', 'activeTab', 'scripting', 'tts', 'storage'],
    host_permissions: [`${API_ORIGIN}/*`],
    action: { default_title: 'Form Saathi' },
    commands: {
      // Reserved command: same path as clicking the toolbar button. Users can
      // change it at chrome://extensions/shortcuts.
      _execute_action: { suggested_key: { default: 'Alt+Shift+F' } },
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
