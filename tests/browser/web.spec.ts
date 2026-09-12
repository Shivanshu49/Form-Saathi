import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rulePacks } from '@form-saathi/rules';

// The companion site: built output served by `next start`, checked for the
// facts it must share with the extension and the claims it must never make.

const pages = ['/', '/install', '/guide', '/practice', '/workflows', '/privacy', '/limitations', '/results'];

test('every page is navigable by keyboard, labelled, and free of axe violations', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // Skip link first, then the header brand, then the main navigation.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'मुख्य सामग्री पर जाएँ' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(accessibility.violations, path).toEqual([]);
  }
});

test('installation instructions match the actual package and manifest', async ({ page }) => {
  const manifest = JSON.parse(readFileSync(resolve('apps/extension/.output/chrome-mv3/manifest.json'), 'utf8')) as {
    version: string; permissions: string[]; minimum_chrome_version: string; commands: { _execute_action: { suggested_key: { default: string } } };
  };
  await page.goto('/install');
  await expect(page.getByText(`form-saathiextension-${manifest.version}-chrome.zip`)).toBeVisible();
  await expect(page.getByText(`Chrome ${manifest.minimum_chrome_version}`)).toBeVisible();
  await expect(page.getByText(manifest.commands._execute_action.suggested_key.default).first()).toBeVisible();
  const permissionsText = await page.getByRole('region', { name: 'यह किन अनुमतियों का उपयोग करता है' }).innerText();
  for (const permission of manifest.permissions) expect(permissionsText).toContain(permission);
  await expect(page.getByText('Load unpacked')).toBeVisible();
});

test('the workflow matrix comes from the rule packs and claims no live support', async ({ page }) => {
  await page.goto('/workflows');
  for (const pack of rulePacks) {
    await expect(page.getByRole('row', { name: new RegExp(pack.id) })).toContainText('असत्यापित');
    await expect(page.getByRole('row', { name: new RegExp(pack.id) })).toContainText(pack.reviewed);
    for (const field of pack.fields) {
      await expect(page.getByRole('rowheader', { name: field.key, exact: true })).toBeVisible();
    }
  }
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/सत्यापित\b(?! —)|guaranteed|100%|सरकारी सेवा है/);
});

test('practice links point at the fixture pages the extension reads', async ({ page, request }) => {
  await page.goto('/practice');
  await expect(page.getByText('केवल प्रदर्शन। ये सरकारी पोर्टल नहीं हैं।')).toBeVisible();
  await expect(page.getByText(/Aadhaar या कोई असली दस्तावेज़ यहाँ न डालें/)).toBeVisible();
  expect(await page.locator('input[type="file"]').count()).toBe(0);
  const links = await page.getByRole('link', { name: /प्रोफ़ाइल [AB] — / }).evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
  expect(links).toHaveLength(8);
  for (const href of links) {
    expect(href).toMatch(/^http:\/\/127\.0\.0\.1:4173\/(nsp|eci-form6)\.html\?variant=[ab]&case=(issues|complete)$/);
    expect((await request.get(href)).status()).toBe(200);
  }
});

test('the results page shows an honest empty state and never invents a number', async ({ page }) => {
  await page.goto('/results');
  await expect(page.getByRole('heading', { name: 'अभी कोई सत्र दर्ज नहीं' })).toBeVisible();
  await expect(page.getByText(/कोई प्रतिभागी सत्र नहीं हुआ है और कोई मापा हुआ सुधार नहीं है/)).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\d+\s*%/);
});

test('no page claims affiliation, universal compatibility, acceptance or measured impact', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/Government of India|भारत सरकार द्वारा|आधिकारिक पोर्टल|सभी वेबसाइटों पर काम|स्वीकृति की गारंटी|% तेज़|% कम त्रुटि/);
    await expect(page.getByRole('contentinfo')).toContainText('किसी सरकारी संस्था से संबद्ध नहीं');
  }
});
