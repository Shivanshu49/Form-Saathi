import { chromium, expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resolve } from 'node:path';

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
    await expect.poll(() => worker.evaluate(async () =>
      (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick,
    )).toBe(true);

    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['sidePanel']);
    expect(manifest.host_permissions).toEqual(['http://127.0.0.1:3000/*']);
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html');

    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const healthRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/health')) healthRequests.push(request.method());
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.getByRole('heading', { name: 'फ़ॉर्म साथी', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByText('वास्तविक फ़ॉर्म पर परीक्षण बाकी है।')).toHaveCount(2);
    expect(healthRequests).toEqual([]);

    const button = page.getByRole('button', { name: 'सेवा की स्थिति जाँचें' });
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('सेवा उपलब्ध है।');
    await expect(button).toBeFocused();
    expect(healthRequests).toEqual(['GET']);

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    // Both an invalid contract and a disconnected API must be recoverable.
    await page.route('**/health', (route) => route.fulfill({ json: { status: 'ok' } }));
    await button.press('Enter');
    await expect(page.getByRole('status')).toContainText('सेवा से संपर्क नहीं हो पाया');
    await page.unroute('**/health');
    await page.route('**/health', (route) => route.abort());
    await button.press('Enter');
    await expect(page.getByRole('status')).toContainText('सेवा से संपर्क नहीं हो पाया');
    await page.unroute('**/health');
    await button.press('Enter');
    await expect(page.getByRole('status')).toHaveText('सेवा उपलब्ध है।');
    await expect(button).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
