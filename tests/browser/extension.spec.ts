import { chromium, expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { API_ORIGIN } from '../../apps/extension/config.js';

test('the installed extension opens its panel page and checks service accessibly', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 400, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    // The toolbar button opens the panel itself, which is what grants activeTab.
    await expect.poll(() => worker.evaluate(() => chrome.action.onClicked.hasListeners())).toBe(true);
    expect(await worker.evaluate(async () =>
      (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick,
    )).toBeFalsy();

    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['sidePanel', 'activeTab', 'scripting', 'tts', 'storage']);
    // One constant sets both the fetch target and the permission Chrome shows.
    expect(manifest.host_permissions).toEqual([`${API_ORIGIN}/*`]);
    // No content script matches: the reader is injected into one activated tab.
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
    expect(manifest.commands?.['_execute_action']?.suggested_key).toEqual({ default: 'Alt+Shift+F' });

    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const healthRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/health')) healthRequests.push(request.method());
    });

    // Opened without a tab: the panel offers no form actions until it is activated.
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.getByRole('heading', { name: 'Form Saathi', exact: true })).toBeVisible();
    await expect(page.getByRole('status').first())
      .toContainText('Activate Form Saathi from the toolbar');
    await expect(page.getByRole('button', { name: 'Rescan' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('combobox', { name: 'Interface language' })).toHaveValue('en');
    expect(healthRequests).toEqual([]);

    const settings = page.getByRole('button', { name: 'Settings', exact: true });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(settings).toBeFocused();
    await page.keyboard.press('Enter');
    const button = page.getByRole('button', { name: 'Check service status' });
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#service-status')).toHaveText('Service available.');
    await expect(button).toBeFocused();
    expect(healthRequests).toEqual(['GET']);

    // The extension ships no provider key and no shared permanent credential.
    const bundle = await readdir(extensionPath, { recursive: true, withFileTypes: true });
    const scripts = bundle.filter((entry) => entry.isFile() && /\.(js|html|json)$/.test(entry.name));
    expect(scripts.length).toBeGreaterThan(3);
    for (const entry of scripts) {
      const text = await readFile(resolve(entry.parentPath, entry.name), 'utf8');
      expect(text).not.toMatch(/api-subscription-key|sk_[A-Za-z0-9]{8}|SARVAM_API_KEY|PILOT_TOKEN_SECRET/);
    }

    // The reader only reads: no submit, click, event dispatch or checkbox write
    // exists in the code that runs inside a portal page.
    const reader = await readFile(resolve(extensionPath, 'reader.js'), 'utf8');
    expect(reader).not.toMatch(/requestSubmit|\.submit\(|dispatchEvent\(|\.click\(|\.checked\s*=[^=]/);

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    // Both an invalid contract and a disconnected API must be recoverable.
    await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
    await button.press('Enter');
    await expect(page.locator('#service-status')).toContainText('Could not reach the service');
    await page.unroute('**/health');
    await page.route('**/health', (route) => route.abort());
    await button.press('Enter');
    await expect(page.locator('#service-status')).toContainText('Could not reach the service');
    await page.unroute('**/health');
    await button.press('Enter');
    await expect(page.locator('#service-status')).toHaveText('Service available.');
    await expect(button).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
