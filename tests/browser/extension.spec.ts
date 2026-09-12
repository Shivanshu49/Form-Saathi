import { chromium, expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

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
    expect(manifest.host_permissions).toEqual(['http://127.0.0.1:3000/*']);
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
    await expect(page.getByRole('heading', { name: 'फ़ॉर्म साथी', exact: true })).toBeVisible();
    await expect(page.getByRole('status').first())
      .toContainText('यह पैनल किसी टैब से नहीं जुड़ा है।');
    await expect(page.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByText('वास्तविक फ़ॉर्म पर परीक्षण बाकी है।')).toHaveCount(2);
    expect(healthRequests).toEqual([]);

    const button = page.getByRole('button', { name: 'सेवा की स्थिति जाँचें' });
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').last()).toHaveText('सेवा उपलब्ध है।');
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
    await expect(page.getByRole('status').last()).toContainText('सेवा से संपर्क नहीं हो पाया');
    await page.unroute('**/health');
    await page.route('**/health', (route) => route.abort());
    await button.press('Enter');
    await expect(page.getByRole('status').last()).toContainText('सेवा से संपर्क नहीं हो पाया');
    await page.unroute('**/health');
    await button.press('Enter');
    await expect(page.getByRole('status').last()).toHaveText('सेवा उपलब्ध है।');
    await expect(button).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
