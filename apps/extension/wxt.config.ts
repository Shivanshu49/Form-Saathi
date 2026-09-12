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
    name: 'Form Saathi — फ़ॉर्म साथी',
    minimum_chrome_version: '114',
    permissions: ['sidePanel'],
    host_permissions: [`${API_ORIGIN}/*`],
    action: { default_title: 'फ़ॉर्म साथी खोलें' },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
