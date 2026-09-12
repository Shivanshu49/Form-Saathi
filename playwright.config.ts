import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  reporter: 'list',
  webServer: {
    command: 'npm run start --workspace @form-saathi/api',
    url: 'http://127.0.0.1:3000/health',
    env: { PORT: '3000', HOST: '127.0.0.1' },
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
