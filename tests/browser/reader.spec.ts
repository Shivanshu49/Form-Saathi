import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resolve } from 'node:path';

// Chrome grants activeTab only through the real toolbar gesture, which Playwright
// cannot perform, and a docked side panel cannot be driven either. These checks
// serve the practice pages under the extension's existing loopback host
// permission and open the panel document at its own URL, so injection,
// messaging, focus and tab lifecycle run exactly as they do in the product.
const PRACTICE = 'http://127.0.0.1:3000';
const FIXTURES = 'http://127.0.0.1:4173';

declare global {
  interface Window {
    __spoken?: string[];
    __voices?: { voiceName: string; lang: string; remote: boolean }[];
    __getUserMedia?: MediaDevices['getUserMedia'];
  }
}

const TINY_WAV = Buffer.from('RIFF\u0000\u0000\u0000\u0000WAVEfmt ').toString('base64');
const apiError = (error: string) => ({ status: 502, json: { error, message: 'test failure', fields: [] } });

/** The cloud steps a person takes once per browser session. */
async function enableCloud(panel: Page, credential = 'fs1.test-credential'): Promise<void> {
  // Consent and the credential persist for the browser session, so a later
  // panel in the same run may already have them.
  if (await panel.getByRole('button', { name: 'क्लाउड सुविधा बंद करें' }).count() === 0) {
    await panel.getByRole('button', { name: 'समझ गया — क्लाउड सुविधा चालू करें' }).click();
  }
  if (await panel.getByText('क्रेडेंशियल सहेजा हुआ है।').count() === 0) {
    await panel.getByLabel('पायलट क्रेडेंशियल').fill(credential);
    await panel.getByRole('button', { name: 'क्रेडेंशियल सहेजें' }).click();
  }
  await expect(panel.getByText('क्रेडेंशियल सहेजा हुआ है।')).toBeVisible();
}

/** Records for a moment on the fake microphone and sends it. */
async function recordAndSend(panel: Page): Promise<void> {
  await panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' }).click();
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.waitForTimeout(700);
  await panel.getByRole('button', { name: 'रोकें और भेजें' }).click();
}

let context: BrowserContext;
let worker: Worker;
let extensionId: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 420, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // A silent fake microphone that needs no permission prompt.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => { await context.close(); });

/** Serves a practice page to the browser from the origin the extension may read. */
async function openPractice(path: string, body?: string): Promise<Page> {
  const page = await context.newPage();
  await page.route(`${PRACTICE}/**`, async (route) => {
    if (body !== undefined && route.request().url() === `${PRACTICE}${path}`) {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
      return;
    }
    await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(PRACTICE, FIXTURES) }) });
  });
  await page.goto(`${PRACTICE}${path}`);
  return page;
}

async function tabIdOf(page: Page): Promise<number> {
  await page.bringToFront();
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.id);
  expect(typeof tabId).toBe('number');
  return tabId as number;
}

/** The panel has a second status for the service check; the first is the reader's. */
function readerStatus(panel: Page) {
  return panel.getByRole('status').first();
}

async function openPanel(page: Page): Promise<Page> {
  const panel = await context.newPage();
  // Record read-aloud requests, with one fake local Hindi voice on offer:
  // nothing may speak without an explicit action.
  await panel.addInitScript(() => {
    window.__spoken = [];
    window.__voices = [{ voiceName: 'Test Hindi', lang: 'hi-IN', remote: false }];
    chrome.tts.getVoices = () => Promise.resolve(window.__voices ?? []);
    chrome.tts.speak = (text: string) => { window.__spoken?.push(text); return Promise.resolve(); };
    chrome.tts.stop = () => undefined;
  });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${await tabIdOf(page)}`);
  await expect(readerStatus(panel)).not.toHaveText('पेज पढ़ा जा रहा है…');
  return panel;
}

function fieldButton(panel: Page, name: string | RegExp) {
  return panel.getByRole('listitem').filter({ has: panel.getByRole('button', { name }) });
}

test('reads the NSP practice form, moves focus, and follows dynamic changes', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const panel = await openPanel(page);

  await expect(readerStatus(panel)).toHaveText('13 फ़ील्ड पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।');
  await expect(panel.getByText('NSP सामान्य जानकारी — केवल अभ्यास')).toBeVisible();
  await expect(panel.getByText('स्थानीय अभ्यास पेज — यह सरकारी पोर्टल नहीं है।')).toBeVisible();
  await expect(panel.getByText('किसी समर्थित कार्यप्रवाह की पुष्टि नहीं हुई।')).toBeVisible();

  // The list keeps the page's own sections.
  await expect(panel.getByRole('heading', { level: 3, name: '1. OTR से आई जानकारी — केवल पढ़ें' })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 3, name: '2. पते का सीमित अभ्यास' })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 3, name: '3. अभ्यास के लिए जोड़े गए फ़ील्ड' })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 3, name: 'अन्य फ़ील्ड' })).toBeVisible();

  // The current field starts at the first field and carries its instructions.
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  await expect(card).toContainText('फ़ील्ड 1 / 13 · 1. OTR से आई जानकारी — केवल पढ़ें');
  await expect(card).toContainText('अंग्रेज़ी नाम — केवल पढ़ें');
  await expect(card).toContainText('काल्पनिक संदर्भ में दी गई अंग्रेज़ी वर्तनी से तुलना करें।');
  await expect(card.getByText('KAVYA SAI')).toHaveAttribute('lang', 'en');

  // Labels, instructions, native constraints and inherited read-only values.
  const name = fieldButton(panel, 'अंग्रेज़ी नाम — केवल पढ़ें');
  await expect(name).toContainText('मान: KAVYA SAI');
  await expect(name).toContainText('केवल पढ़ें');
  await expect(fieldButton(panel, 'जन्म तारीख — केवल पढ़ें')).toContainText('मान: 31/02/2004');
  // A long identifier is masked until the person asks for it.
  await expect(fieldButton(panel, 'OTR संदर्भ (अभ्यास में आवश्यक)')).toContainText('मान छिपा है: •••••••••0001');
  expect(await panel.locator('body').innerText()).not.toContain('9000000000001');

  // An empty required select, and a radio group read as one choice.
  const district = fieldButton(panel, 'जिला (अभ्यास में आवश्यक)');
  await expect(district).toContainText('आवश्यक');
  await expect(district).toContainText('कोई विकल्प नहीं चुना गया।');
  const locality = fieldButton(panel, 'क्षेत्र का प्रकार (अभ्यास में आवश्यक)');
  await expect(locality).toContainText('चुना गया: अन्य');
  await expect(panel.getByRole('button', { name: 'ग्रामीण' })).toHaveCount(0);

  // The unsupported frame is named in the review as not checked, never read.
  await expect(panel.getByText('अलग फ़्रेम — इसकी सामग्री नहीं पढ़ी गई: असमर्थित स्थानीय अभ्यास फ़्रेम')).toBeVisible();

  // Nothing of the panel's own styling reaches the page.
  const stylesheets = () => page.evaluate(() => document.querySelectorAll('style, link[rel="stylesheet"]').length);
  expect(await stylesheets()).toBe(1);

  const accessibility = await new AxeBuilder({ page: panel })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  // Selecting an item focuses the original control in the page.
  await panel.getByRole('button', { name: 'जिला (अभ्यास में आवश्यक)' }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('nsp-district');
  await panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('nsp-otr');

  // Selecting a field from the list makes it current, with its format rule.
  await panel.getByRole('button', { name: 'डाक PIN (अभ्यास में आवश्यक)' }).click();
  await expect(card).toContainText('पेज का प्रारूप नियम: [0-9]{6}');
  await expect(card).toContainText('फ़ील्ड 7 / 13');

  // A conditional field the page hides keeps its place but loses its value.
  const other = fieldButton(panel, 'क्षेत्र लिखें (अन्य चुनने पर अभ्यास में आवश्यक)');
  await expect(other).toContainText('अभी खाली है।');
  await page.getByRole('radio', { name: 'शहरी' }).check();
  await expect(other).toContainText('अभी लागू नहीं — यह फ़ील्ड छिपा या निष्क्रिय है।');
  await expect(locality).toContainText('चुना गया: शहरी');

  // A field inserted after the first read appears without touching the panel.
  await expect(panel.getByRole('button', { name: 'अभ्यास टिप्पणी (वैकल्पिक)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'अतिरिक्त अभ्यास फ़ील्ड जोड़ें' }).click();
  await expect(panel.getByRole('button', { name: 'अभ्यास टिप्पणी (वैकल्पिक)' })).toBeVisible();
  await expect(readerStatus(panel)).toHaveText('14 फ़ील्ड पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।');

  // Typed values reach the panel, and no page value ever leaves the browser.
  const requests: string[] = [];
  panel.on('request', (request) => requests.push(request.url()));
  await page.locator('#nsp-district').selectOption('lucknow');
  await expect(district).toContainText('चुना गया: लखनऊ');
  expect(requests.filter((url) => !url.startsWith('chrome-extension://'))).toEqual([]);
  expect(await stylesheets()).toBe(1);
  expect(errors).toEqual([]);
});

test('checks the practice form against its rule pack, and only what it can check', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);

  // The oracle seeds four corrections and one name confirmation per profile.
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (4)' })).toBeVisible();
  await expect(panel.getByText('जन्म तारीख — केवल पढ़ें: महीना 2, वर्ष 2004 में केवल 29 दिन होते हैं।').first()).toBeVisible();
  await expect(panel.getByText('जिला (अभ्यास में आवश्यक): यह जानकारी अभी नहीं भरी गई।')).toBeVisible();
  await expect(panel.getByText(/OTR 14 अंकों का होता है; अभी 13 वर्ण हैं। यह Aadhaar नहीं है।/)).toBeVisible();
  await expect(panel.getByText('स्रोत: N1').first()).toBeVisible();

  // A name is only compared against a reference the person supplies themselves.
  await expect(panel.getByRole('heading', { name: 'पुष्टि चाहिए (0)' })).toBeVisible();
  await panel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)').fill('KAVYA SAIN');
  await expect(panel.getByRole('heading', { name: 'पुष्टि चाहिए (1)' })).toBeVisible();
  // Shown twice on purpose: on the current field, and in the review.
  await expect(panel.getByText('अंग्रेज़ी नाम — केवल पढ़ें: फ़ॉर्म में “KAVYA SAI” है, आपके संदर्भ में “KAVYA SAIN”।'))
    .toHaveCount(2);
  await expect(panel.getByText(/बोलकर वर्तनी तय नहीं होती/).first()).toBeVisible();

  // What the packs cannot establish is listed as unchecked, never as approval.
  await expect(panel.getByText('PIN और जिले का आपस में मेल नहीं जाँचा गया: इसके लिए समीक्षित डाक निर्देशिका नहीं है।'))
    .toBeVisible();
  await expect(panel.getByText(/नियम पैक nsp-2026-27-basic-general 1.0 \(समीक्षा 2026-09-12\) का लाइव परीक्षण बाकी है/))
    .toBeVisible();
  await expect(panel.getByText(/विवरण 2: इस फ़ील्ड का अर्थ तय नहीं है/)).toBeVisible();
  await expect(panel.getByText(/OTR किसका है और वह जारी हुआ है या नहीं, यह जाँचा नहीं गया/)).toBeVisible();

  // A result leads to its own field, and correcting it there clears the result.
  const districtResult = panel.getByRole('listitem')
    .filter({ hasText: 'जिला (अभ्यास में आवश्यक): यह जानकारी अभी नहीं भरी गई।' });
  await districtResult.getByRole('button', { name: 'फ़ील्ड पर जाएँ' }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('nsp-district');
  await page.locator('#nsp-district').selectOption('lucknow');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (3)' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page: panel })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('a filled practice profile produces no correction and no confirmation', async () => {
  const nsp = await openPractice('/nsp.html?variant=a&case=complete');
  const nspPanel = await openPanel(nsp);
  await nspPanel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)').fill('KAVYA SAIN');
  await expect(nspPanel.getByRole('heading', { name: 'सुधार चाहिए (0)' })).toBeVisible();
  await expect(nspPanel.getByRole('heading', { name: 'पुष्टि चाहिए (0)' })).toBeVisible();
  await expect(nspPanel.getByText('अभी कोई नतीजा नहीं। इसका अर्थ “सब ठीक है” नहीं है।').first()).toBeVisible();

  const eci = await openPractice('/eci-form6.html?variant=b&case=issues');
  const eciPanel = await openPanel(eci);
  await expect(eciPanel.getByRole('heading', { name: 'सुधार चाहिए (4)' })).toBeVisible();
  await expect(eciPanel.getByText(/डाक PIN \(आवश्यक\): इस अभ्यास में PIN छह अंकों का माना गया है; अभी 5 वर्ण हैं।/))
    .toBeVisible();
  // An empty optional email is not missing information.
  await expect(eciPanel.getByText(/ईमेल/).filter({ hasText: 'नहीं भरी गई' })).toHaveCount(0);
});

test('the interface works from the keyboard alone and keeps focus across updates', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });

  // Tab order: read again, field navigation, the page control, then read aloud.
  for (const name of ['फ़ॉर्म फिर पढ़ें', 'पिछला फ़ील्ड', 'अगला फ़ील्ड', 'मूल फ़ील्ड पर जाएँ', 'पढ़कर सुनाएँ', 'पढ़ना रोकें']) {
    await panel.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name, exact: true })).toBeFocused();
  }
  await panel.keyboard.press('Tab');
  await expect(panel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)')).toBeFocused();

  // Tabbing onward reaches the field list: the review between them traps nothing.
  const firstField = panel.getByRole('button', { name: 'अंग्रेज़ी नाम — केवल पढ़ें' });
  let reached = false;
  for (let step = 0; step < 30 && !reached; step += 1) {
    await panel.keyboard.press('Tab');
    reached = await firstField.evaluate((element) => element === document.activeElement);
  }
  expect(reached).toBe(true);

  // Moving through fields announces once, keeps focus, and never touches the page.
  const next = panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true });
  await next.focus();
  await panel.keyboard.press('Enter');
  await expect(readerStatus(panel)).toHaveText('फ़ील्ड 2 / 13: जन्म तारीख — केवल पढ़ें। वैकल्पिक · केवल पढ़ें');
  await expect(next).toBeFocused();
  await panel.keyboard.press('Enter');
  await expect(card).toContainText('फ़ील्ड 3 / 13');
  await expect(next).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('');

  // The first field cannot move backwards past the start, and says so once.
  const previous = panel.getByRole('button', { name: 'पिछला फ़ील्ड', exact: true });
  for (let step = 0; step < 3; step += 1) await previous.press('Enter');
  await expect(card).toContainText('फ़ील्ड 1 / 13');
  await expect(previous).toHaveAttribute('aria-disabled', 'true');
  await previous.press('Enter');
  await expect(readerStatus(panel)).toHaveText('यह पहला फ़ील्ड है।');
  await expect(previous).toBeFocused();

  // Only the explicit control moves focus into the page, and the route back is stated.
  await next.press('Enter');
  await next.press('Enter');
  await panel.getByRole('button', { name: 'मूल फ़ील्ड पर जाएँ' }).press('Enter');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('nsp-gender');
  await expect(readerStatus(panel)).toHaveText('पेज में फ़ोकस: लिंग — केवल पढ़ें। लौटने के लिए F6 दबाएँ।');
  await expect(panel.getByText('पेज पर जाने के बाद पैनल पर लौटने के लिए F6 दबाएँ, या Alt+Shift+F से फ़ॉर्म साथी फिर खोलें।')).toBeVisible();

  // A page update must not move the panel's focus or reset its position.
  const listButton = panel.getByRole('button', { name: 'डाक PIN (अभ्यास में आवश्यक)' });
  await listButton.focus();
  await page.locator('#nsp-address').fill('99, काल्पनिक अभ्यास पथ');
  await page.locator('#nsp-district').selectOption('lucknow');
  await expect(fieldButton(panel, 'मकान और सड़क (अभ्यास में आवश्यक)')).toContainText('मान: 99, काल्पनिक अभ्यास पथ');
  await expect(listButton).toBeFocused();
  await expect(card).toContainText('फ़ील्ड 3 / 13');

  // A narrow docked panel must not need sideways scrolling.
  await panel.setViewportSize({ width: 320, height: 800 });
  expect(await panel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(listButton).toBeFocused();
  await panel.setViewportSize({ width: 420, height: 900 });
});

test('a page it may not read is reported as unsupported, not as an empty form', async () => {
  // Served from the fixture port, which the extension has no host access to.
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/nsp.html?variant=a&case=issues`);
  const panel = await openPanel(page);

  await expect(readerStatus(panel)).toHaveText(
    'यह पेज नहीं पढ़ा जा सकता। उसी टैब पर टूलबार का बटन दबाकर फ़ॉर्म साथी चालू करें। ब्राउज़र के अपने पेज कभी नहीं पढ़े जाते।',
  );
  for (const name of ['फ़ील्ड सूची', 'समीक्षा', 'मौजूदा फ़ील्ड']) {
    await expect(panel.getByRole('heading', { name })).toHaveCount(0);
  }
  await expect(panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page: panel })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('long identifiers stay masked until asked for, and nothing speaks on its own', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  const spoken = () => panel.evaluate(() => window.__spoken ?? []);

  expect(await spoken()).toEqual([]);
  await panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' }).click();
  await expect(card).toContainText('मान छिपा है: •••••••••0001');

  // Reading aloud a masked value asks for it to be revealed first.
  await panel.getByRole('button', { name: 'पढ़कर सुनाएँ' }).click();
  const masked = await spoken();
  expect(masked).toHaveLength(1);
  expect(masked[0]).toContain('OTR संदर्भ');
  expect(masked[0]).toContain('पूरा मान सुनने के लिए पहले उसे दिखाएँ।');
  expect(masked[0]).not.toContain('9000000000001');

  await panel.getByRole('button', { name: 'पूरा मान दिखाएँ' }).click();
  await expect(card).toContainText('मान: 9000000000001');
  await expect(readerStatus(panel)).toHaveText('पूरा मान दिखाया गया: OTR संदर्भ (अभ्यास में आवश्यक)');
  await panel.getByRole('button', { name: 'पढ़कर सुनाएँ' }).click();
  expect((await spoken())[1]).toContain('9000000000001');
  await panel.getByRole('button', { name: 'पढ़ना रोकें' }).click();
  await expect(readerStatus(panel)).toHaveText('पढ़ना रोका गया।');

  // Editing another field refreshes values without re-announcing or re-masking.
  await page.locator('#nsp-address').fill('77, काल्पनिक अभ्यास पथ');
  await expect(fieldButton(panel, 'मकान और सड़क (अभ्यास में आवश्यक)')).toContainText('मान: 77, काल्पनिक अभ्यास पथ');
  await expect(readerStatus(panel)).toHaveText('पढ़ना रोका गया।');
  await expect(card).toContainText('मान: 9000000000001');

  // A new field is a new situation, so the status describes the page again.
  await page.getByRole('button', { name: 'अतिरिक्त अभ्यास फ़ील्ड जोड़ें' }).click();
  await expect(readerStatus(panel)).toHaveText('14 फ़ील्ड पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।');
  await expect(card).toContainText('मान: 9000000000001');

  // Without a verified local Hindi voice nothing is spoken, and the panel still works.
  await panel.evaluate(() => { window.__voices = [{ voiceName: 'Remote Hindi', lang: 'hi-IN', remote: true }]; });
  await panel.getByRole('button', { name: 'पढ़कर सुनाएँ' }).click();
  await expect(readerStatus(panel)).toHaveText(/कोई स्थानीय हिंदी आवाज़ नहीं मिली/);
  expect(await spoken()).toHaveLength(2);
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('फ़ील्ड 11 / 14');

  // A reloaded page is a new document, so it starts masked again.
  await page.reload();
  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(readerStatus(panel)).toHaveText('13 फ़ील्ड पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।');
  await panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' }).click();
  await expect(card).toContainText('मान छिपा है: •••••••••0001');
});

test('keeps each tab separate and drops the review when its page or tab ends', async () => {
  const nspPage = await openPractice('/nsp.html?variant=a&case=issues');
  const nspPanel = await openPanel(nspPage);
  const eciPage = await openPractice('/eci-form6.html?variant=b&case=issues');
  const eciPanel = await openPanel(eciPage);

  await expect(eciPanel.getByRole('button', { name: 'नाम — हिंदी (अभ्यास में आवश्यक)' })).toBeVisible();
  await expect(fieldButton(eciPanel, 'नाम — अंग्रेज़ी बड़े अक्षरों में (यदि दिया हो)')).toContainText('मान: AMAN RO');
  await expect(fieldButton(eciPanel, 'ईमेल (यदि उपलब्ध हो; वैकल्पिक)')).toContainText('अभी खाली है।');

  // Neither review may show the other tab's page, before or after it changes.
  await eciPage.getByRole('button', { name: 'अतिरिक्त अभ्यास फ़ील्ड जोड़ें' }).click();
  await expect(eciPanel.getByRole('button', { name: 'अभ्यास टिप्पणी (वैकल्पिक)' })).toBeVisible();
  await expect(nspPanel.getByRole('button', { name: 'नाम — हिंदी (अभ्यास में आवश्यक)' })).toHaveCount(0);
  await expect(nspPanel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toBeVisible();
  await expect(eciPanel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toHaveCount(0);

  // A reload invalidates the snapshot; reading again recovers.
  await nspPage.reload();
  await expect(readerStatus(nspPanel))
    .toHaveText('पेज फिर से लोड हुआ। पिछली पढ़ी गई जानकारी हटा दी गई है। फ़ॉर्म फिर पढ़ें।');
  await expect(nspPanel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toHaveCount(0);
  await nspPanel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(readerStatus(nspPanel)).toHaveText('13 फ़ील्ड पढ़े गए। 1 जगह नहीं पढ़ी जा सकीं।');

  // Closing the tab clears what was read from it.
  await eciPage.close();
  await expect(readerStatus(eciPanel))
    .toHaveText('जिस टैब की समीक्षा थी वह बंद हो गया। पढ़ी गई जानकारी हटा दी गई है।');
  await expect(eciPanel.getByRole('button', { name: 'नाम — हिंदी (अभ्यास में आवश्यक)' })).toHaveCount(0);
});

test('leaves secrets and unsupported controls unread, and says so', async () => {
  const page = await openPractice('/secrets.html', `<!doctype html>
<html lang="hi"><head><meta charset="UTF-8"><title>गुप्त फ़ील्ड की जाँच</title></head>
<body><main><h1>गुप्त फ़ील्ड की जाँच</h1><form>
<label for="pw">पासवर्ड</label><input id="pw" type="password" value="SECRET-PASSWORD">
<label for="otp">OTP</label><input id="otp" name="otp" autocomplete="one-time-code" value="654321">
<label for="captcha">कैप्चा का उत्तर</label><input id="captcha" name="captcha-response" value="SECRET-CAPTCHA">
<label for="card">Card number</label><input id="card" autocomplete="cc-number" value="4111111111111111">
<label for="upload">दस्तावेज़ चुनें</label><input id="upload" type="file">
<label for="pin">डाक PIN</label><input id="pin" name="postal-pin" pattern="[0-9]{6}" value="226001">
</form></main></body></html>`);
  const panel = await openPanel(page);

  await expect(readerStatus(panel)).toHaveText('1 फ़ील्ड पढ़े गए। 5 जगह नहीं पढ़ी जा सकीं।');
  await expect(fieldButton(panel, 'डाक PIN')).toContainText('मान: 226001');
  await expect(panel.getByText('संवेदनशील फ़ील्ड — जानबूझकर नहीं पढ़ा गया: पासवर्ड')).toBeVisible();
  await expect(panel.getByText('संवेदनशील फ़ील्ड — जानबूझकर नहीं पढ़ा गया: OTP')).toBeVisible();
  await expect(panel.getByText('संवेदनशील फ़ील्ड — जानबूझकर नहीं पढ़ा गया: कैप्चा का उत्तर')).toBeVisible();
  await expect(panel.getByText('असमर्थित नियंत्रण — नहीं पढ़ा गया: दस्तावेज़ चुनें')).toBeVisible();
  // No pack describes this page, so nothing about its fields is claimed.
  await expect(panel.getByText('इस पेज के लिए कोई समीक्षित नियम पैक नहीं है, इसलिए किसी फ़ील्ड की जाँच नहीं हुई।'))
    .toBeVisible();
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (0)' })).toBeVisible();

  const shown = await panel.locator('body').innerText();
  for (const secret of ['SECRET-PASSWORD', '654321', 'SECRET-CAPTCHA', '4111111111111111']) {
    expect(shown).not.toContain(secret);
  }
});

test('a spoken value becomes a suggestion the person checks and applies themselves', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const cloudRequests: string[] = [];
  panel.on('request', (request) => { if (request.url().includes('/v1/')) cloudRequests.push(request.url()); });

  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  await expect(panel.getByText('बोलकर बताने के लिए पहले नीचे “क्लाउड सुविधा” चालू करें।')).toBeVisible();
  // The explanation says what is sent and does not promise redaction.
  await expect(panel.getByText(/कच्ची आवाज़ से कुछ हटाया नहीं जा सकता/).first()).toBeVisible();
  await enableCloud(panel);
  expect(cloudRequests).toEqual([]);

  let transcribeBody = '';
  let transcribeAuth = '';
  await panel.route('**/v1/speech/transcribe', async (route) => {
    transcribeBody = route.request().postDataBuffer()?.toString('latin1') ?? '';
    transcribeAuth = route.request().headers()['authorization'] ?? '';
    await route.fulfill({ json: { transcript: 'पंद्रह अगस्त दो हज़ार', languageCode: 'hi-IN', requiresConfirmation: true } });
  });
  const interpretBodies: string[] = [];
  let suggestion: unknown = { outcome: 'suggestion', value: '15/08/2000', explanation: 'दिन, महीना और वर्ष तीनों बोले गए।' };
  await panel.route('**/v1/values/interpret', async (route) => {
    interpretBodies.push(route.request().postData() ?? '');
    await route.fulfill({ json: { interpretation: suggestion, requiresConfirmation: true } });
  });

  await recordAndSend(panel);
  const transcript = panel.getByLabel('सुना गया पाठ — ज़रूरत हो तो सुधारें');
  await expect(transcript).toHaveValue('पंद्रह अगस्त दो हज़ार');
  expect(transcribeBody).toContain('name="audio"');
  expect(transcribeAuth).toBe('Bearer fs1.test-credential');

  // The transcript can be corrected before anything is interpreted.
  await transcript.fill('पंद्रह अगस्त दो हज़ार');
  await panel.getByRole('button', { name: 'इस पाठ को समझें' }).click();
  await expect(panel.getByText('सुझाया गया मान: 15/08/2000')).toBeVisible();
  await expect(panel.getByText('स्थानीय जाँच में कोई कमी नहीं मिली। यह पुष्टि नहीं है: पोर्टल के नियम अलग हो सकते हैं।')).toBeVisible();
  // Only approved minimal context goes out: never the field's current value.
  expect(interpretBodies[0]).toContain('जन्म तारीख');
  expect(interpretBodies[0]).not.toContain('31/02/2000');
  // The page is never written to: the person makes the change themselves.
  expect(await page.locator('#eci-dob').inputValue()).toBe('31/02/2000');

  // A suggestion that fails the local rules is shown as needing correction.
  suggestion = { outcome: 'suggestion', value: '31/02/2000', explanation: 'जैसा बोला गया।' };
  await panel.getByRole('button', { name: 'फिर से रिकॉर्ड करें' }).click();
  await recordAndSend(panel);
  await panel.getByRole('button', { name: 'इस पाठ को समझें' }).click();
  await expect(panel.getByText(/सुधार चाहिए: जन्म तारीख \(अभ्यास में आवश्यक\): महीना 2, वर्ष 2000 में केवल 29 दिन होते हैं।/)).toBeVisible();

  // An ambiguous date asks for clarification and proposes nothing.
  suggestion = { outcome: 'unknown', explanation: 'वर्ष नहीं बोला गया। पूरा वर्ष बताएँ।' };
  await panel.getByRole('button', { name: 'फिर से रिकॉर्ड करें' }).click();
  await recordAndSend(panel);
  await panel.getByRole('button', { name: 'इस पाठ को समझें' }).click();
  await expect(panel.getByText('स्पष्ट करें: वर्ष नहीं बोला गया। पूरा वर्ष बताएँ।')).toBeVisible();
  await expect(panel.getByText(/सुझाया गया मान/)).toHaveCount(0);

  // Asking what a field means sends its text, not its value, and needs confirmation.
  let meaningBody = '';
  await panel.route('**/v1/fields/interpret', async (route) => {
    meaningBody = route.request().postData() ?? '';
    await route.fulfill({ json: {
      interpretation: { outcome: 'suggestion', kind: 'date', explanation: 'यह जन्म की तारीख माँगता है।', example: '15/08/2000' },
      requiresConfirmation: true,
    } });
  });
  await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
  await expect(panel.getByText('AI का अनुमान: तारीख')).toBeVisible();
  expect(meaningBody).not.toContain('31/02/2000');
  expect(meaningBody).not.toContain('"value"');
  await panel.getByRole('button', { name: 'मिलाकर देखा — मान लें' }).click();
  await expect(panel.getByText(/आपने इसे मान लिया है/)).toBeVisible();

  // Generic help audio is the service's own text, played by native controls.
  await panel.route('**/v1/speech/help', (route) => route.fulfill({ json: {
    topic: 'privacy', text: 'फ़ॉर्म की जानकारी आपके ब्राउज़र में रहती है।', contentType: 'audio/wav', audio: TINY_WAV,
  } }));
  await panel.getByLabel('विषय').selectOption('privacy');
  await panel.getByRole('button', { name: 'सहायता का ऑडियो लाएँ' }).click();
  await expect(panel.locator('audio[controls]')).toHaveCount(1);
  await expect(panel.getByText('फ़ॉर्म की जानकारी आपके ब्राउज़र में रहती है।')).toBeVisible();

  const accessibility = await new AxeBuilder({ page: panel })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('speech failures leave keyboard navigation and local checks usable', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  await enableCloud(panel);

  // Identifier and read-only fields never offer recording.
  await panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' }).click();
  await expect(panel.getByText(/यह पहचान-संख्या या संवेदनशील फ़ील्ड है/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'अंग्रेज़ी नाम — केवल पढ़ें' }).click();
  await expect(panel.getByText(/यह फ़ील्ड केवल पढ़ने के लिए है/)).toBeVisible();

  // A denied microphone is explained; nothing else changes.
  await panel.getByRole('button', { name: 'मकान और सड़क (अभ्यास में आवश्यक)' }).click();
  await panel.evaluate(() => {
    window.__getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' }).click();
  await expect(panel.getByText(/माइक्रोफ़ोन की अनुमति नहीं मिली/).first()).toBeVisible();
  await panel.evaluate(() => {
    if (window.__getUserMedia) navigator.mediaDevices.getUserMedia = window.__getUserMedia;
  });
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('डाक PIN (अभ्यास में आवश्यक)');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (4)' })).toBeVisible();

  // Moving to another field resets the speech section, which starts idle there.
  // The service itself is unconfigured in this run: the real answer is 503.
  await recordAndSend(panel);
  await expect(panel.getByText(/यह सेवा इस सर्वर पर चालू नहीं है/).first()).toBeVisible();

  // A failing provider, and a cancelled request, both return to a usable state.
  await panel.route('**/v1/speech/transcribe', (route) => route.fulfill(apiError('provider_unavailable')));
  await panel.getByRole('button', { name: 'फिर से कोशिश करें' }).click();
  await recordAndSend(panel);
  await expect(panel.getByText(/भाषा सेवा अभी उपलब्ध नहीं है/).first()).toBeVisible();
  await panel.unroute('**/v1/speech/transcribe');
  await panel.route('**/v1/speech/transcribe', () => undefined);
  await panel.getByRole('button', { name: 'फिर से कोशिश करें' }).click();
  await recordAndSend(panel);
  await expect(panel.getByText('पाठ बन रहा है…', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'रद्द करें' }).click();
  await expect(readerStatus(panel)).toHaveText('रद्द किया गया। कुछ नहीं भेजा गया।');
  await expect(panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' })).toBeVisible();

  // Local checks and navigation are untouched by all of it.
  await panel.getByRole('button', { name: 'पिछला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('मकान और सड़क (अभ्यास में आवश्यक)');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (4)' })).toBeVisible();
  await page.locator('#nsp-district').selectOption('lucknow');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (3)' })).toBeVisible();
});

test('a stalled service times out without trapping the person', async () => {
  test.setTimeout(60_000);
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await enableCloud(panel);
  await panel.getByRole('button', { name: 'जिला (आवश्यक)' }).click();
  await panel.route('**/v1/speech/transcribe', () => undefined);
  await recordAndSend(panel);
  await expect(panel.getByText(/सेवा ने समय पर जवाब नहीं दिया/).first()).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' })).toContainText('राज्य (आवश्यक)');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (4)' })).toBeVisible();
});

test('the final review is acknowledged only for the data actually reviewed', async () => {
  // Form 6 has no read-only fields, so every seeded issue can be corrected here.
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  const status = panel.getByRole('region', { name: 'स्थिति', exact: true });
  const table = panel.getByRole('table');
  const spoken = () => panel.evaluate(() => window.__spoken ?? []);
  const acknowledge = panel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' });
  await panel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)').fill('ARUN DEV');

  // Summary, next-issue navigation and the structured table.
  await expect(panel.getByText(/14 फ़ील्ड पढ़े गए · 4 सुधार · 1 पुष्टि/)).toBeVisible();
  await expect(status).toContainText('समीक्षा अभी स्वीकृत नहीं');
  await panel.getByRole('button', { name: /अगली समस्या/ }).click();
  await expect(card).toContainText('नाम — अंग्रेज़ी बड़े अक्षरों में (यदि दिया हो)');
  await expect(readerStatus(panel)).toHaveText(/^समस्या 1 \/ 5: /);
  await panel.getByRole('button', { name: /अगली समस्या/ }).click();
  await expect(card).toContainText('जन्म तारीख (अभ्यास में आवश्यक)');
  await expect(table.getByRole('row', { name: /^जिला \(आवश्यक\)/ })).toContainText('अभी खाली है');
  await expect(table.getByRole('row', { name: /^जिला \(आवश्यक\)/ })).toContainText('सुधार चाहिए');
  await expect(table.getByRole('row', { name: /^प्रोफ़ाइल/ })).toContainText('नियम पैक में नहीं');
  await expect(table.getByRole('row', { name: /^विवरण 2/ })).toContainText('मान छिपा है');

  // The spoken review uses the local voice and repeats the boundaries.
  await panel.getByRole('button', { name: 'समीक्षा सुनें' }).click();
  const review = (await spoken()).at(-1) ?? '';
  expect(review).toContain('4 सुधार, 1 पुष्टि');
  expect(review).toContain('पोर्टल की स्वीकृति, पहचान की पुष्टि या आवेदन भेजना नहीं है');

  // Acknowledging with issues open records the reading, not a clean result.
  await acknowledge.click();
  await expect(status).toContainText('समीक्षा पढ़ी गई, पर 4 सुधार बाकी हैं।');
  await expect(status).toContainText(/पढ़ने की स्वीकृति: दर्ज — संशोधन [0-9a-f]{8}/);

  // Correcting a seeded issue updates the result and makes the acknowledgment stale.
  await page.locator('#eci-district').fill('लखनऊ');
  await expect(panel.getByRole('heading', { name: 'सुधार चाहिए (3)' })).toBeVisible();
  await expect(status).toContainText('स्वीकृति अमान्य');
  await expect(readerStatus(panel)).toHaveText('फ़ॉर्म बदल गया: पिछली स्वीकृति अमान्य है। समीक्षा फिर पढ़ें और फिर स्वीकृति दें।');
  await acknowledge.click();
  await expect(status).toContainText('समीक्षा पढ़ी गई, पर 3 सुधार बाकी हैं।');

  // A value a script sets, with no event at all, is still seen and invalidates.
  await page.evaluate(() => { document.querySelector<HTMLInputElement>('#eci-address')!.value = '99, बदली हुई गली'; });
  await expect(table.getByRole('row', { name: /^मकान और सड़क/ })).toContainText('99, बदली हुई गली', { timeout: 10_000 });
  await expect(status).toContainText('स्वीकृति अमान्य');

  // Acknowledging re-reads first: a change made just before is never signed off as old data.
  await page.evaluate(() => { document.querySelector<HTMLInputElement>('#eci-address')!.value = '77, फिर बदली गली'; });
  await acknowledge.click();
  // Either the change is reported (as a refusal or as the stale notice), or the
  // acknowledgment was recorded — in which case it must be for the new value.
  await expect.poll(async () => {
    const changed = /फ़ॉर्म बदल गया/.test((await readerStatus(panel).textContent()) ?? '');
    const recorded = (await status.getByText(/पढ़ने की स्वीकृति: दर्ज/).count()) > 0;
    return changed || recorded;
  }).toBe(true);
  if (await status.getByText(/पढ़ने की स्वीकृति: दर्ज/).count() > 0) {
    await expect(table.getByRole('row', { name: /^मकान और सड़क/ })).toContainText('77, फिर बदली गली');
  }

  // Nothing was typed into the page and nothing was submitted.
  await expect(page.locator('#practice-status')).toHaveText('बदलाव केवल इस खुले पृष्ठ में रहते हैं। कोई आवेदन नहीं भेजा जाता।');
  expect(await page.locator('#eci-pin').inputValue()).toBe('22601');
  expect(await page.locator('#eci-dob').inputValue()).toBe('31/02/2000');
});

test('a filled profile is a partial review, never all-clear, and secrets block it', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=complete');
  const panel = await openPanel(page);
  const status = panel.getByRole('region', { name: 'स्थिति', exact: true });
  await panel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)').fill('KAVYA SAIN');
  await expect(panel.getByText(/13 फ़ील्ड पढ़े गए · 0 सुधार · 0 पुष्टि/)).toBeVisible();
  // Kept focusable while aria-disabled, so it explains itself instead of vanishing.
  await panel.getByRole('button', { name: /अगली समस्या/ }).press('Enter');
  await expect(readerStatus(panel)).toHaveText('कोई खुली समस्या नहीं। जाँचा-नहीं-गया हिस्से समीक्षा में हैं।');
  await panel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' }).click();
  // The unsupported frame keeps this from ever reading as clear.
  await expect(status).toContainText('आंशिक समीक्षा: कवरेज अधूरी है');
  await expect(status).not.toContainText('समीक्षा स्वीकृत:');
  await expect(status).toContainText('आवेदन भेजना: इसका कोई भरोसेमंद प्रमाण पैनल के पास नहीं है।');

  // An error on a read-only field cannot be fixed in this form: the review is blocked.
  const inherited = await openPractice('/nsp.html?variant=a&case=issues');
  const inheritedPanel = await openPanel(inherited);
  await inheritedPanel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' }).click();
  const inheritedStatus = inheritedPanel.getByRole('region', { name: 'स्थिति', exact: true });
  await expect(inheritedStatus).toContainText('रुकी हुई');
  await expect(inheritedStatus).toContainText(/रुकावट: जन्म तारीख — केवल पढ़ें/);

  const secrets = await openPractice('/secrets.html', `<!doctype html>
<html lang="hi"><head><meta charset="UTF-8"><title>गुप्त फ़ील्ड की जाँच</title></head>
<body><main><h1>गुप्त फ़ील्ड की जाँच</h1><form>
<label for="captcha">कैप्चा का उत्तर</label><input id="captcha" name="captcha-response">
<label for="pin">डाक PIN</label><input id="pin" name="postal-pin" value="226001">
</form></main></body></html>`);
  const secretsPanel = await openPanel(secrets);
  await secretsPanel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' }).click();
  const secretsStatus = secretsPanel.getByRole('region', { name: 'स्थिति', exact: true });
  await expect(secretsStatus).toContainText('रुकी हुई');
  await expect(secretsStatus).toContainText('रुकावट: कैप्चा का उत्तर');

  const accessibility = await new AxeBuilder({ page: panel })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
