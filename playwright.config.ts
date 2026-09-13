import { defineConfig } from '@playwright/test';

// The `live` project talks to the real provider through the service Playwright
// starts from `.env`; it exists only when FORM_SAATHI_LIVE=1 is set, so an
// ordinary run never reaches Sarvam and never reports a skipped live test.
const live = process.env['FORM_SAATHI_LIVE'] === '1';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'extension', testMatch: ['extension.spec.ts', 'reader.spec.ts', 'lifecycle.spec.ts', 'localization.spec.ts'] },
    {
      name: 'practice', testMatch: 'practice.spec.ts',
      use: { channel: 'chromium', baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'web', testMatch: 'web.spec.ts',
      use: { channel: 'chromium', baseURL: 'http://127.0.0.1:3100', locale: 'hi-IN' },
    },
    ...(live ? [{ name: 'live', testMatch: 'live-sarvam.spec.ts' }] : []),
  ],
  webServer: [
    {
      command: 'npm run build --workspace @form-saathi/api && ' + (live
        ? 'npm run start --workspace @form-saathi/api'
        : 'node -e "delete process.env.SARVAM_API_KEY; delete process.env.PILOT_TOKEN_SECRET; import(\'./apps/api/dist/main.js\')"'),
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
