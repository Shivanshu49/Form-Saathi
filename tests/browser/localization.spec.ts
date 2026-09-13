import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { locales, localeNames, translator, type Locale } from '@form-saathi/contracts';

const output = resolve('docs/redesign/screenshots');
let context: BrowserContext;
let worker: Worker;
let extensionId: string;

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const extension = resolve('apps/extension/.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, locale: 'hi-IN', viewport: { width: 400, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});
test.afterAll(async () => { await context.close(); });

async function openPanel() {
  const portal = await context.newPage();
  await portal.route('http://127.0.0.1:3000/**', async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(':3000', ':4173') }) }));
  await portal.goto('http://127.0.0.1:3000/eci-form6.html?variant=a&case=issues');
  const before = await portal.evaluate(() => ({ styles: document.querySelectorAll('style,link[rel="stylesheet"]').length, background: getComputedStyle(document.body).backgroundColor, margin: getComputedStyle(document.body).margin }));
  await portal.bringToFront();
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]!.id);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tab}`);
  await expect(panel.locator('.current-field')).toBeVisible();
  return { panel, portal, before };
}
async function select(panel: Page, locale: Locale) {
  await panel.locator('.language-control select').selectOption(locale);
  await expect(panel.locator('html')).toHaveAttribute('lang', locale);
  await expect(panel.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  await expect(panel.locator('.language-control select')).toHaveValue(locale);
}
async function fits(panel: Page) {
  expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('fresh English ignores browser language; five locales persist without rewriting values, sources, or acknowledgment', async () => {
  test.setTimeout(90_000);
  await worker.evaluate(() => chrome.storage.local.clear());
  const { panel, portal, before } = await openPanel();
  expect(await panel.evaluate(() => navigator.language)).toBe('hi-IN');
  await expect(panel.locator('html')).toHaveAttribute('lang', 'en');
  await expect(panel.getByRole('heading', { name: 'Form Saathi', exact: true })).toBeVisible();
  await expect(panel.locator('.language-control select')).toHaveAccessibleName('Interface language');
  expect(await panel.locator('.language-control option').allTextContents()).toEqual(locales.map((locale) => localeNames[locale]));
  await expect(panel.locator('#settings')).toBeHidden();
  await panel.screenshot({ path: resolve(output, 'extension-english.png'), fullPage: true });
  for (let i = 0; i < 3; i++) await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(panel.locator('.current-field .issue.error')).toBeVisible();
  await panel.screenshot({ path: resolve(output, 'extension-field-issue.png'), fullPage: true });
  for (let i = 0; i < 3; i++) await panel.getByRole('button', { name: 'Previous', exact: true }).click();

  await panel.locator('.reference > summary').click();
  const reference = 'ARUN—DEV';
  await panel.locator('#reference-name').fill(reference);
  await panel.getByRole('button', { name: 'Review form', exact: true }).click();
  await expect(panel.locator('.review h3').first()).toBeFocused();
  await panel.getByRole('button', { name: 'I have read the displayed review' }).click();
  await expect(panel.locator('.acknowledgement')).toContainText('Acknowledgment: Recorded:');
  const originalValues = await portal.locator('input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

  for (const locale of locales) {
    const t = translator(locale);
    await select(panel, locale);
    await expect(panel.locator('#reference-name')).toHaveValue(reference);
    await expect(panel.locator('.acknowledgement')).toContainText(t('review.receiptCurrent', { revision: '' }).trim());
    await expect(panel.locator('.source-text span[lang="hi"]').first()).toBeVisible();
    const source = await panel.locator('.source-text').innerText();
    expect(source).toContain('अभ्यास');
    await panel.setViewportSize({ width: 320, height: 900 });
    await fits(panel);
    const accessibility = await new AxeBuilder({ page: panel }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(accessibility.violations, locale).toEqual([]);
    await panel.locator('.current-field').screenshot({ path: resolve(output, `field-${locale}.png`) });
    if (locale === 'ar') {
      // 200% text zoom on the real panel, including its expanded review.
      await panel.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await fits(panel);
      await panel.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
  }
  expect(await portal.locator('input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(originalValues);
  expect(await portal.evaluate(() => ({ styles: document.querySelectorAll('style,link[rel="stylesheet"]').length, background: getComputedStyle(document.body).backgroundColor, margin: getComputedStyle(document.body).margin }))).toEqual(before);
  await panel.locator('.review > details > summary').click();
  await panel.locator('.reference > summary').click();
  await panel.evaluate(() => scrollTo(0, 0));
  await panel.screenshot({ path: resolve(output, 'extension-arabic.png'), fullPage: true });
  await panel.reload();
  await expect(panel.locator('.language-control select')).toHaveValue('ar');
  await expect(panel.locator('html')).toHaveAttribute('dir', 'rtl');
  await panel.close(); await portal.close();
});

test('unsupported cloud locales send nothing; language changes cancel permission and request lifetimes', async () => {
  const { panel, portal } = await openPanel();
  await select(panel, 'en');
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await panel.getByLabel('Pilot credential').fill('fs1.test-credential');
  await panel.getByRole('button', { name: 'Save credential' }).click();
  await panel.getByRole('button', { name: 'I understand. Enable cloud assistance' }).click();
  await panel.getByRole('button', { name: 'Back to form' }).click();
  await expect(panel.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await panel.locator('.fields-disclosure > summary').click();
  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  const sent: string[] = [];
  panel.on('request', (request) => { if (request.url().includes('/v1/')) sent.push(request.url()); });
  for (const locale of ['es', 'fr', 'ar'] as const) {
    await select(panel, locale);
    await expect(panel.locator('.speech-assist')).toContainText(translator(locale)('speech.unavailable'));
    await expect(panel.locator('.speech-assist button')).toHaveCount(0);
    await panel.locator('.field-navigation button').nth(1).click();
    await panel.locator('.field-navigation button').first().click();
  }
  expect(sent).toEqual([]);
  await select(panel, 'en');
  await panel.evaluate(() => {
    const state = { pending: null as (() => void) | null, stopped: false };
    (window as unknown as { pendingMic: typeof state }).pendingMic = state;
    navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => {
      state.pending = () => resolve({ getTracks: () => [{ stop: () => { state.stopped = true; } }] } as unknown as MediaStream);
    });
  });
  await panel.getByRole('button', { name: 'Start recording' }).click();
  await select(panel, 'es');
  await panel.evaluate(() => (window as unknown as { pendingMic: { pending: () => void } }).pendingMic.pending());
  expect(await panel.evaluate(() => (window as unknown as { pendingMic: { stopped: boolean } }).pendingMic.stopped)).toBe(true);
  expect(sent).toEqual([]);
  await select(panel, 'en');
  await panel.getByRole('button', { name: 'Type instead' }).click();
  await expect(panel.locator('#transcript')).toBeFocused();
  await panel.locator('#transcript').fill('15 August 2000');
  let release: (() => Promise<void>) | undefined;
  await panel.route('**/v1/values/interpret', async (route) => {
    expect(route.request().postDataJSON().locale).toBe('en');
    release = () => route.fulfill({ json: { interpretation: { outcome: 'suggestion', value: '15/08/2000', explanation: 'Late reply' }, requiresConfirmation: true } }).catch(() => {});
  });
  await panel.getByRole('button', { name: 'Interpret this text' }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect.poll(() => typeof release).toBe('function');
  await select(panel, 'fr');
  await release!();
  await expect(panel.getByText('Late reply')).toHaveCount(0);
  await expect(panel.locator('.speech-assist')).toContainText(translator('fr')('speech.unavailable'));
  await panel.close(); await portal.close();
});

test('original instructions retain inline languages and punctuation; source language changes invalidate review', async () => {
  const { panel, portal } = await openPanel();
  await select(panel, 'en');
  await portal.evaluate(() => {
    const instructions = document.createElement('p');
    instructions.id = 'mixed-language-instructions';
    instructions.innerHTML = '<span lang="fr">Texte original — A–B.</span> <span lang="ar">تعليمات أصلية.</span>';
    document.body.append(instructions);
    document.querySelector('#eci-name-hi')!.setAttribute('aria-describedby', instructions.id);
  });
  const source = panel.locator('.source-text');
  await expect(source.locator('[lang="fr"]')).toHaveText('Texte original — A–B.');
  await expect(source.locator('[lang="ar"]')).toHaveText('تعليمات أصلية.');
  await panel.getByRole('button', { name: 'Review form', exact: true }).click();
  await panel.getByRole('button', { name: 'I have read the displayed review' }).click();
  await expect(panel.locator('.acknowledgement')).toContainText('Acknowledgment: Recorded:');
  await portal.locator('#mixed-language-instructions [lang="fr"]').evaluate((element) => { element.setAttribute('lang', 'es'); });
  await expect(source.locator('[lang="es"]')).toHaveText('Texte original — A–B.');
  await expect(panel.locator('.acknowledgement')).toContainText('Acknowledgment: No longer valid:');
  await expect(portal.locator('html')).toHaveAttribute('lang', 'hi');
  await panel.close(); await portal.close();
});
