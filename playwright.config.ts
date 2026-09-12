import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'extension', testMatch: ['extension.spec.ts', 'reader.spec.ts'] },
    {
      name: 'practice', testMatch: 'practice.spec.ts',
      use: { channel: 'chromium', baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'web', testMatch: 'web.spec.ts',
      use: { channel: 'chromium', baseURL: 'http://127.0.0.1:3100' },
    },
  ],
  webServer: [
    {
      command: 'npm run build --workspace @form-saathi/api && npm run start --workspace @form-saathi/api',
      url: 'http://127.0.0.1:3000/health',
      env: { PORT: '3000', HOST: '127.0.0.1' },
      reuseExistingServer: false, timeout: 30_000,
    },
    {
      command: 'npm run preview:fixtures', url: 'http://127.0.0.1:4173',
      reuseExistingServer: false, timeout: 20_000,
    },
    {
      command: 'npm run start --workspace @form-saathi/web', url: 'http://127.0.0.1:3100',
      reuseExistingServer: false, timeout: 30_000,
    },
  ],
});
