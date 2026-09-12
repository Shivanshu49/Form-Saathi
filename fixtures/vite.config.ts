import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    rolldownOptions: {
      input: ['index.html', 'nsp.html', 'eci-form6.html'].map((path) =>
        fileURLToPath(new URL(path, import.meta.url))),
    },
  },
});
