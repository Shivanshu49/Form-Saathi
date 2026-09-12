import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { resolve } from 'node:path';
import type { FormSnapshot } from '@form-saathi/contracts';

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
    __media?: {
      /** Permission requests waiting for the test to answer them. */
      pending: { resolve: () => Promise<void>; reject: (error: Error) => void }[];
      tracks: { stopped: boolean }[];
      recorders: { state: string }[];
    };
    __recorders?: {
      state: RecordingState;
      stops: number;
      ondataavailable: ((event: { data: Blob }) => void) | null;
      onstop: (() => void) | null;
    }[];
    __meaningReplies?: { signal: AbortSignal; resolve: (body: unknown) => void }[];
    __scanReplies?: { hold: boolean; pending: { resolve: () => void }[] };
    __focusReplies?: { hold: boolean; pending: (() => void)[] };
  }
}

const TINY_WAV = Buffer.from('RIFF\u0000\u0000\u0000\u0000WAVEfmt ').toString('base64');
const apiError = (error: string) => ({ status: 502, json: { error, message: 'test failure', fields: [] } });

/** The cloud steps a person takes once per browser session. */
async function enableCloud(panel: Page, credential = 'fs1.test-credential'): Promise<void> {
  await expect(panel.getByRole('region', { name: 'क्लाउड सुविधा', exact: true })).toBeVisible();
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
  // The upload had already started, so cancelling does not claim nothing was sent.
  await expect(readerStatus(panel)).toHaveText('अनुरोध रद्द किया गया। जो भेजा जा चुका था वह वापस नहीं आता; उसका जवाब अब नहीं लिया जाएगा।');
  await expect(panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' })).toBeVisible();
  // Before the upload, cancelling discards the recording and says exactly that.
  await panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' }).click();
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.getByRole('button', { name: 'रद्द करें' }).click();
  await expect(readerStatus(panel)).toHaveText('रिकॉर्डिंग हटा दी गई। कुछ नहीं भेजा गया।');

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

/** Puts the panel's microphone and recorder under the test's control. */
async function controlMicrophone(panel: Page): Promise<void> {
  await panel.evaluate(() => {
    const media = { pending: [] as NonNullable<Window['__media']>['pending'], tracks: [] as { stopped: boolean }[], recorders: [] as { state: string }[] };
    window.__media = media;
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => new Promise<MediaStream>((resolve, reject) => {
      media.pending.push({
        resolve: async () => {
          const stream = await real(constraints);
          for (const track of stream.getTracks()) {
            const record = { stopped: false };
            media.tracks.push(record);
            const stop = track.stop.bind(track);
            track.stop = () => { record.stopped = true; stop(); };
          }
          resolve(stream);
        },
        reject,
      });
    });
    const Real = window.MediaRecorder;
    window.MediaRecorder = class extends Real {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        media.recorders.push(this);
      }
    };
  });
}

const media = (panel: Page) => panel.evaluate(() => ({
  pending: window.__media?.pending.length ?? 0,
  tracks: window.__media?.tracks.map((track) => track.stopped) ?? [],
  recorders: window.__media?.recorders.map((recorder) => recorder.state) ?? [],
}));

/** Answers the oldest waiting microphone permission request. */
const grantMicrophone = (panel: Page) => panel.evaluate(async () => { await window.__media?.pending.shift()?.resolve(); });

test('a recording session that was left behind sends nothing and releases the microphone', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  const cloudRequests: string[] = [];
  panel.on('request', (request) => { if (request.url().includes('/v1/')) cloudRequests.push(new URL(request.url()).pathname); });
  await enableCloud(panel);
  await controlMicrophone(panel);
  const start = panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' });
  const consentOff = panel.getByRole('button', { name: 'क्लाउड सुविधा बंद करें' });
  const consentOn = panel.getByRole('button', { name: 'समझ गया — क्लाउड सुविधा चालू करें' });

  // Permission answered after the person moved to another field: the stream is
  // stopped at once, no recorder is created and nothing is sent.
  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  await start.click();
  await expect.poll(async () => (await media(panel)).pending).toBe(1);
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('आयु के दस्तावेज़ का अभ्यास विकल्प (आवश्यक)');
  await grantMicrophone(panel);
  await expect.poll(async () => (await media(panel)).tracks).toEqual([true]);
  expect((await media(panel)).recorders).toEqual([]);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toHaveCount(0);

  // Repeated presses make one permission request; consent withdrawn while it
  // is pending discards the answer.
  await panel.getByRole('button', { name: 'मकान और सड़क (आवश्यक)' }).click();
  await start.click();
  await start.click();
  await start.click();
  await expect.poll(async () => (await media(panel)).pending).toBe(1);
  await consentOff.click();
  await expect(panel.getByText('बोलकर बताने के लिए पहले नीचे “क्लाउड सुविधा” चालू करें। कीबोर्ड से पढ़ना और जाँच वैसे ही चलते रहते हैं।')).toBeVisible();
  await grantMicrophone(panel);
  await expect.poll(async () => (await media(panel)).tracks).toEqual([true, true]);
  expect((await media(panel)).recorders).toEqual([]);
  await consentOn.click();
  await expect(start).toBeVisible();

  // Consent withdrawn during a recording stops it, releases the microphone and
  // never uploads what was captured — also not when the time limit would have.
  await start.click();
  await grantMicrophone(panel);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  expect((await media(panel)).recorders).toEqual(['recording']);
  await consentOff.click();
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toHaveCount(0);
  await expect.poll(async () => (await media(panel)).tracks).toEqual([true, true, true]);
  await expect.poll(async () => (await media(panel)).recorders).toEqual(['inactive']);
  await consentOn.click();
  await expect(start).toBeVisible();
  await panel.waitForTimeout(1_000);
  expect(cloudRequests).toEqual([]);

  // A reply that arrives after cancellation, or after a new session began, is dropped.
  let held: Parameters<Parameters<Page['route']>[1]>[0] | null = null;
  await panel.route('**/v1/speech/transcribe', (route) => { held = route; });
  const release = async () => {
    await held?.fulfill({ json: { transcript: 'देर से आया पाठ', languageCode: 'hi-IN', requiresConfirmation: true } }).catch(() => undefined);
    held = null;
  };
  await start.click();
  await grantMicrophone(panel);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.waitForTimeout(500);
  await panel.getByRole('button', { name: 'रोकें और भेजें' }).click();
  await expect(panel.getByText('पाठ बन रहा है…', { exact: true })).toBeVisible();
  await expect.poll(() => cloudRequests).toEqual(['/v1/speech/transcribe']);
  await panel.getByRole('button', { name: 'रद्द करें' }).click();
  await expect(start).toBeVisible();
  await release();
  await panel.waitForTimeout(500);
  await expect(panel.getByLabel('सुना गया पाठ — ज़रूरत हो तो सुधारें')).toHaveCount(0);
  await expect(start).toBeVisible();

  await start.click();
  await grantMicrophone(panel);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.waitForTimeout(500);
  await panel.getByRole('button', { name: 'रोकें और भेजें' }).click();
  await expect(panel.getByText('पाठ बन रहा है…', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('जिला (आवश्यक)');
  await release();
  await panel.waitForTimeout(500);
  await expect(panel.getByLabel('सुना गया पाठ — ज़रूरत हो तो सुधारें')).toHaveCount(0);
  await expect(panel.getByText('पाठ बन रहा है…', { exact: true })).toHaveCount(0);
  await expect(start).toBeVisible();
  expect(cloudRequests).toEqual(['/v1/speech/transcribe', '/v1/speech/transcribe']);
  expect((await media(panel)).tracks.every(Boolean)).toBe(true);
});

test('help audio needs consent and a credential in code, one request at a time', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const helpRequests: string[] = [];
  panel.on('request', (request) => { if (request.url().includes('/v1/speech/help')) helpRequests.push(request.method()); });
  const fetchHelp = panel.getByRole('button', { name: 'सहायता का ऑडियो लाएँ' });
  const consentOff = panel.getByRole('button', { name: 'क्लाउड सुविधा बंद करें' });
  const consentOn = panel.getByRole('button', { name: 'समझ गया — क्लाउड सुविधा चालू करें' });
  await enableCloud(panel);

  // A saved credential with consent switched off: the button stays reachable and explains itself.
  await consentOff.click();
  await expect(panel.getByText('क्रेडेंशियल सहेजा हुआ है।')).toBeVisible();
  await fetchHelp.focus();
  await panel.keyboard.press('Enter');
  await expect(readerStatus(panel)).toHaveText('इसके लिए पहले क्लाउड सुविधा चालू करें और क्रेडेंशियल सहेजें।');
  await expect(fetchHelp).toBeFocused();
  expect(helpRequests).toEqual([]);

  // Consent without a credential.
  await consentOn.click();
  await panel.getByRole('button', { name: 'क्रेडेंशियल हटाएँ' }).click();
  await expect(panel.getByText('अभी कोई क्रेडेंशियल नहीं है।')).toBeVisible();
  // aria-disabled keeps the button focusable; the keyboard still reaches it.
  await fetchHelp.focus();
  await panel.keyboard.press('Enter');
  await expect(readerStatus(panel)).toHaveText('इसके लिए पहले क्लाउड सुविधा चालू करें और क्रेडेंशियल सहेजें।');
  expect(helpRequests).toEqual([]);
  await enableCloud(panel);

  // Repeated activation makes one request; a reply after withdrawal is not shown.
  let held: Parameters<Parameters<Page['route']>[1]>[0] | null = null;
  await panel.route('**/v1/speech/help', (route) => { held = route; });
  const release = async () => {
    await held?.fulfill({ json: {
      topic: 'navigation', text: 'देर से आया सहायता पाठ', contentType: 'audio/wav', audio: TINY_WAV,
    } }).catch(() => undefined);
    held = null;
  };
  await fetchHelp.click();
  await panel.keyboard.press('Enter');
  await panel.keyboard.press('Enter');
  await expect(panel.getByText('ऑडियो लाया जा रहा है…')).toBeVisible();
  await expect.poll(() => helpRequests).toEqual(['POST']);
  await consentOff.click();
  await expect(panel.getByText('ऑडियो लाया जा रहा है…')).toHaveCount(0);
  await release();
  await consentOn.click();
  await panel.waitForTimeout(300);
  await expect(panel.locator('audio[controls]')).toHaveCount(0);
  await expect(panel.getByText('देर से आया सहायता पाठ')).toHaveCount(0);

  // The panel losing its page unmounts the section; its late reply is dropped too.
  await fetchHelp.click();
  await expect.poll(() => helpRequests).toEqual(['POST', 'POST']);
  await page.reload();
  await expect(readerStatus(panel)).toHaveText('पेज फिर से लोड हुआ। पिछली पढ़ी गई जानकारी हटा दी गई है। फ़ॉर्म फिर पढ़ें।');
  await release();
  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(fetchHelp).toBeVisible();
  await expect(panel.locator('audio[controls]')).toHaveCount(0);
  await expect(panel.getByText('देर से आया सहायता पाठ')).toHaveCount(0);
  expect(helpRequests).toEqual(['POST', 'POST']);
});

test('an acknowledgment covers instructions, constraints and option labels, not just values', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const status = panel.getByRole('region', { name: 'स्थिति', exact: true });
  const acknowledge = panel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' });
  const recorded = async () => {
    await expect(status).toContainText(/पढ़ने की स्वीकृति: दर्ज — संशोधन [0-9a-f]{8}/);
    // Acknowledging re-reads the form; let that push settle before the next change.
    await panel.waitForTimeout(500);
  };
  const stale = () => expect(status).toContainText('स्वीकृति अमान्य');

  await acknowledge.click();
  await recorded();

  // Unchanged page: polling and unrelated mutations keep the acknowledgment.
  await page.evaluate(() => { document.body.classList.add('touched'); document.body.setAttribute('data-touched', 'yes'); });
  await panel.waitForTimeout(3_500);
  await recorded();

  // Instructions changed.
  await page.evaluate(() => { document.querySelector('#pin-help')!.textContent = 'अब PIN पाँच अंकों का माना गया है।'; });
  await stale();
  await acknowledge.click();
  await recorded();

  // A native constraint changed.
  await page.evaluate(() => { document.querySelector('#eci-pin')!.setAttribute('pattern', '[0-9]{5}'); });
  await stale();
  await panel.getByRole('button', { name: 'डाक PIN (आवश्यक)' }).click();
  await expect(panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' })).toContainText('पेज का प्रारूप नियम: [0-9]{5}');
  await acknowledge.click();
  await recorded();

  // The selected radio keeps its value while its visible label changes.
  await page.evaluate(() => {
    const label = document.querySelector('#eci-age-proof-other-choice')!.parentElement!;
    label.lastChild!.textContent = 'सूची के दस्तावेज़ उपलब्ध नहीं — कोई और दस्तावेज़';
  });
  await stale();
  await expect(panel.getByRole('table').getByRole('row', { name: /^आयु के दस्तावेज़ का अभ्यास विकल्प/ })).toContainText('कोई और दस्तावेज़');
  expect(await page.locator('#eci-age-proof-other-choice').isChecked()).toBe(true);
  await acknowledge.click();
  await recorded();

  // Acknowledging still re-reads the form first.
  await page.evaluate(() => { document.querySelector('#eci-district')!.setAttribute('aria-label', 'ज़िला (बदला हुआ)'); });
  await expect(status).toContainText('स्वीकृति अमान्य');
  await acknowledge.click();
  await recorded();
  await expect(panel.getByRole('button', { name: 'ज़िला (बदला हुआ)' })).toBeVisible();
});

test('audit regression: cancelled recorder callbacks cannot contaminate or stop the next recording', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await enableCloud(panel);
  await panel.getByRole('button', { name: 'मकान और सड़क (आवश्यक)' }).click();
  await controlMicrophone(panel);
  await panel.clock.install();
  await panel.evaluate(() => {
    window.__recorders = [];
    window.MediaRecorder = class {
      state: RecordingState = 'inactive';
      stops = 0;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() { return true; }
      constructor() { window.__recorders!.push(this); }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.stops += 1; }
    } as unknown as typeof MediaRecorder;
  });
  const uploads: string[] = [];
  await panel.route('**/v1/speech/transcribe', async (route) => {
    uploads.push(route.request().postDataBuffer()!.toString('latin1'));
    await route.fulfill({ json: { transcript: 'नई रिकॉर्डिंग', languageCode: 'hi-IN', requiresConfirmation: true } });
  });
  const start = panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' });
  await start.click();
  await grantMicrophone(panel);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.getByRole('button', { name: 'रद्द करें', exact: true }).click();
  await start.click();
  await grantMicrophone(panel);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.evaluate(() => {
    const old = window.__recorders![0]!;
    old.ondataavailable!({ data: new Blob(['DISCARDED-AUDIO-A']) });
    old.onstop!();
    old.onstop!();
  });
  await panel.clock.runFor(1_000);
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है — 1 सेकंड/)).toBeVisible();
  expect((await media(panel)).tracks).toEqual([true, false]);
  expect(await panel.evaluate(() => window.__recorders![1]!.stops)).toBe(0);
  expect(uploads).toEqual([]);
  // A's callbacks must not clear B's 15-second timer either.
  await panel.clock.runFor(14_000);
  expect(await panel.evaluate(() => window.__recorders![1]!.stops)).toBe(1);
  await panel.evaluate(() => {
    const current = window.__recorders![1]!;
    current.ondataavailable!({ data: new Blob(['ONLY-AUDIO-B']) });
    current.onstop!();
  });
  await expect(panel.getByLabel('सुना गया पाठ — ज़रूरत हो तो सुधारें')).toHaveValue('नई रिकॉर्डिंग');
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain('ONLY-AUDIO-B');
  expect(uploads[0]).not.toContain('DISCARDED-AUDIO-A');
  expect((await media(panel)).tracks).toEqual([true, true]);
  await panel.close();
  await page.close();
});

for (const transition of ['consent', 'remove', 'replace', 'field', 'document', 'unmount']) {
  test(`audit regression: identifier meaning request expires after ${transition}`, async () => {
    const page = await openPractice('/meaning-lifetime.html', `<!doctype html><html lang="hi"><head><meta charset="UTF-8"><title>Meaning lifetime</title></head><body>
      <label for="nsp-otr">OTR संदर्भ (अभ्यास में आवश्यक)</label><input id="nsp-otr" value="90000000000001">
      <label for="nsp-locality">स्थान</label><input id="nsp-locality" value="rural">
      </body></html>`);
    const panel = await openPanel(page);
    await enableCloud(panel);
    const identifier = panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' });
    await identifier.click();
    await expect(panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' })).toHaveCount(0);
    // Deliberately ignore abort when resolving: the component must also reject
    // a late successful reply, not merely rely on fetch to reject it.
    await panel.evaluate(() => {
      window.__meaningReplies = [];
      const original = window.fetch.bind(window);
      window.fetch = (url, init) => {
        if (!String(url).endsWith('/v1/fields/interpret')) return original(url, init);
        return new Promise<Response>((resolve) => {
          window.__meaningReplies!.push({ signal: init!.signal!, resolve: (body) => resolve(new Response(JSON.stringify(body), {
            status: 200, headers: { 'content-type': 'application/json' },
          })) });
        });
      };
    });
    await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
    await expect.poll(() => panel.evaluate(() => window.__meaningReplies!.length)).toBe(1);
    if (transition === 'consent') await panel.getByRole('button', { name: 'क्लाउड सुविधा बंद करें' }).click();
    if (transition === 'remove') await panel.getByRole('button', { name: 'क्रेडेंशियल हटाएँ' }).click();
    if (transition === 'replace') {
      await panel.getByLabel('पायलट क्रेडेंशियल').fill('fs1.replacement-fictional-credential');
      await panel.getByRole('button', { name: 'क्रेडेंशियल सहेजें' }).click();
    }
    if (transition === 'field') await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
    if (transition === 'document') {
      await page.reload();
      await expect(readerStatus(panel)).toContainText('पेज फिर से लोड हुआ');
    }
    if (transition === 'unmount') await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
    await expect.poll(() => panel.evaluate(() => window.__meaningReplies![0]!.signal.aborted), { message: transition }).toBe(true);
    if (transition === 'document') await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
    await enableCloud(panel);
    await identifier.click();
    const reply = { interpretation: { outcome: 'suggestion', kind: 'identifier', explanation: `OLD-MEANING-${transition}`, example: null }, requiresConfirmation: true };
    await panel.evaluate((body) => window.__meaningReplies![0]!.resolve(body), reply);
    await panel.waitForTimeout(150);
    await expect(panel.getByText(reply.interpretation.explanation)).toHaveCount(0);
    await expect(readerStatus(panel)).not.toContainText('अर्थ का अनुमान मिला');
    // Re-enabling allows a fresh text-only request, never the old one or recording.
    await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
    await panel.evaluate((body) => window.__meaningReplies![1]!.resolve(body), {
      ...reply, interpretation: { ...reply.interpretation, explanation: 'नया अर्थ' },
    });
    await expect(panel.getByText('नया अर्थ', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' })).toHaveCount(0);
    await panel.close();
    await page.close();
  });
}

test('audit regression: a held NSP review rescan cannot restore or acknowledge it after ECI navigation', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await panel.evaluate(() => {
    window.__scanReplies = { hold: true, pending: [] };
    const original = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = (async (tab: number, message: unknown) => {
      const reply: unknown = await original(tab, message);
      if ((message as { type?: string }).type !== 'scan' || !window.__scanReplies!.hold) return reply;
      return new Promise<unknown>((resolve) => { window.__scanReplies!.pending.push({ resolve: () => resolve(reply) }); });
    }) as typeof chrome.tabs.sendMessage;
  });
  await panel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' }).click();
  await expect.poll(() => panel.evaluate(() => window.__scanReplies!.pending.length)).toBe(1);
  await page.goto(`${PRACTICE}/eci-form6.html?variant=a&case=issues`);
  await expect(readerStatus(panel)).toContainText('पेज फिर से लोड हुआ');
  await panel.evaluate(() => { window.__scanReplies!.hold = false; });
  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(panel.getByRole('button', { name: 'नाम — हिंदी (अभ्यास में आवश्यक)' })).toBeVisible();
  await panel.evaluate(() => window.__scanReplies!.pending[0]!.resolve());
  await panel.waitForTimeout(300);
  await expect(panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toHaveCount(0);
  await expect(panel.getByRole('region', { name: 'स्थिति', exact: true })).toContainText('पढ़ने की स्वीकृति: दर्ज नहीं।');
  await expect(panel.getByRole('button', { name: 'नाम — हिंदी (अभ्यास में आवश्यक)' })).toBeVisible();
  await panel.close();
  await page.close();
});

test('audit regression: secrets are excluded before values or radio options enter a snapshot', async () => {
  const names = ['user_otp', 'otp_code', 'captcha_response', 'card_number', 'userOTP', 'otpCode', 'captchaResponse', 'creditCardNumber', 'card-number', 'security code', 'oneTimeCode', 'OTPCode'];
  const secretControls = names.map((name, index) => `<label for="secret-${index}">विवरण</label><input id="secret-${index}" name="${name}" value="SECRET-VALUE-${index}">`).join('');
  const page = await openPractice('/secret-variants.html', `<!doctype html><html lang="hi"><head><meta charset="UTF-8"><title>Secret variants</title></head><body>
    ${secretControls}
    <input id="user_otp_code" value="SECRET-UNLABELLED">
    <label for="hindi">ओटीपी</label><input id="hindi" aria-label="विवरण" value="SECRET-HINDI">
    <label for="pass">विवरण</label><input id="pass" type="password" value="SECRET-PASSWORD">
    <input id="autofill" aria-label="विवरण" autocomplete="section-checkout billing cc-number" value="SECRET-AUTOCOMPLETE">
    <input id="login" autocomplete="one-time-code" value="SECRET-LOGIN">
    <form id="mixed"><label><input type="radio" name="choice" value="SECRET-GROUP-FIRST">सामान्य विकल्प</label></form>
    <label>विवरण<input type="radio" name="choice" form="mixed" id="cardNumber" checked value="SECRET-GROUP-MEMBER"></label>
    <form><label><input type="radio" name="ordinary" checked value="one">पहला</label></form>
    <form><label><input type="radio" name="ordinary" checked value="two">दूसरा</label></form>
    <label><input type="radio" checked value="unnamed-one">अलग पहला</label>
    <label><input type="radio" checked value="unnamed-two">अलग दूसरा</label>
    <label for="postal_pin">डाक PIN</label><input id="postal_pin" name="postal_pin" inputmode="numeric" value="226001">
    <label for="ordinary_number">सामान्य संख्या</label><input id="ordinary_number" type="number" value="42">
    </body></html>`);
  const panel = await openPanel(page);
  const tabId = await tabIdOf(page);
  const reply = await worker.evaluate(async (tab) => chrome.tabs.sendMessage(tab, { type: 'scan', tabId: tab }), tabId) as { snapshot: FormSnapshot };
  const snapshot = reply.snapshot;
  expect(JSON.stringify(snapshot)).not.toContain('SECRET-');
  expect(snapshot.gaps.filter((gap) => gap.reason === 'sensitive')).toHaveLength(names.length + 6);
  expect(snapshot.fields.map((field) => field.value)).toEqual(['one', 'two', 'unnamed-one', 'unnamed-two', '226001', '42']);
  expect(snapshot.fields.find((field) => field.key === 'postal_pin')?.status).toBe('read');
  await panel.close();
  await page.close();
});

/** Holds the panel's scan replies so a rescan can be answered after the page has moved on. */
async function holdScans(panel: Page): Promise<void> {
  await panel.evaluate(() => {
    window.__scanReplies = { hold: true, pending: [] };
    const original = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = (async (tab: number, message: unknown) => {
      const reply: unknown = await original(tab, message);
      if ((message as { type?: string }).type !== 'scan' || !window.__scanReplies!.hold) return reply;
      return new Promise<unknown>((resolve) => { window.__scanReplies!.pending.push({ resolve: () => resolve(reply) }); });
    }) as typeof chrome.tabs.sendMessage;
  });
}

/** Replaces a page control with an identical clone: same content, new element identity. */
const replaceWithClone = (page: Page, selector: string) => page.evaluate((target) => {
  const control = document.querySelector<HTMLInputElement>(target)!;
  const clone = control.cloneNode(true) as HTMLInputElement;
  clone.value = control.value;
  control.replaceWith(clone);
}, selector);

const focusedControl = (page: Page) => page.evaluate(() => {
  const active = document.activeElement;
  return active instanceof HTMLInputElement ? { id: active.id, value: active.value, form: [...document.forms].indexOf(active.form!) } : null;
});

test('audit regression: an identical control replacement keeps the current field and focuses the replacement', async () => {
  const page = await openPractice('/nsp.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  await panel.getByRole('button', { name: 'डाक PIN (अभ्यास में आवश्यक)' }).click();
  await expect(card).toContainText('फ़ील्ड 7 / 13');
  await expect.poll(() => focusedControl(page)).toEqual({ id: 'nsp-pin', value: '226001', form: 0 });

  // The replacement changes nothing the review sees, yet the panel learns of it.
  await replaceWithClone(page, '#nsp-pin');
  await expect.poll(() => focusedControl(page)).toBeNull();
  await panel.waitForTimeout(600);
  await expect(card).toContainText('फ़ील्ड 7 / 13');
  await expect(card).toContainText('डाक PIN (अभ्यास में आवश्यक)');
  await panel.getByRole('button', { name: 'मूल फ़ील्ड पर जाएँ' }).click();
  await expect.poll(() => focusedControl(page)).toEqual({ id: 'nsp-pin', value: '226001', form: 0 });
  await expect(card).toContainText('फ़ील्ड 7 / 13');
  expect(await page.evaluate(() => document.activeElement?.isConnected)).toBe(true);

  // A focus request already on its way when the control is replaced lands on
  // the replacement too, instead of the panel falling back to the first field.
  await panel.evaluate(() => {
    window.__focusReplies = { hold: true, pending: [] };
    const original = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = (async (tab: number, message: unknown) => {
      if ((message as { type?: string }).type === 'focus' && window.__focusReplies!.hold) {
        await new Promise<void>((resolve) => { window.__focusReplies!.pending.push(resolve); });
      }
      return original(tab, message);
    }) as typeof chrome.tabs.sendMessage;
  });
  await panel.getByRole('button', { name: 'मूल फ़ील्ड पर जाएँ' }).click();
  await expect.poll(() => panel.evaluate(() => window.__focusReplies!.pending.length)).toBe(1);
  await replaceWithClone(page, '#nsp-pin');
  await expect.poll(() => focusedControl(page)).toBeNull();
  await panel.evaluate(() => { window.__focusReplies!.hold = false; window.__focusReplies!.pending[0]!(); });
  await expect.poll(() => focusedControl(page)).toEqual({ id: 'nsp-pin', value: '226001', form: 0 });
  await expect(card).toContainText('फ़ील्ड 7 / 13');
  await expect(card).toContainText('डाक PIN (अभ्यास में आवश्यक)');
  await expect(readerStatus(panel)).not.toContainText('फ़ील्ड 1 / 13');
  await panel.close();
  await page.close();
});

test('audit regression: duplicate names are resolved by form ownership, and an uncertain or removed control is explained, not guessed', async () => {
  const page = await openPractice('/duplicate-names.html', `<!doctype html><html lang="hi"><head><meta charset="UTF-8"><title>Duplicate names</title></head><body>
    <form><label>साझा नाम<input name="shared" value="one"></label></form>
    <form><label>साझा नाम<input name="shared" value="two"></label></form>
    <form><label>जुड़वाँ<input name="twin" value="twin-one"></label><label>जुड़वाँ<input name="twin" value="twin-two"></label></form>
    </body></html>`);
  const panel = await openPanel(page);
  const card = panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' });
  await expect(readerStatus(panel)).toHaveText('4 फ़ील्ड पढ़े गए।');

  // Two id-less forms, same control name and label: the second form's control stays current.
  await panel.getByRole('button', { name: 'साझा नाम' }).nth(1).click();
  await expect(card).toContainText('फ़ील्ड 2 / 4');
  await expect.poll(() => focusedControl(page)).toEqual({ id: '', value: 'two', form: 1 });
  await page.evaluate(() => {
    const control = document.forms[1]!.elements[0] as HTMLInputElement;
    control.replaceWith(control.cloneNode(true));
  });
  await expect.poll(() => focusedControl(page)).toBeNull();
  await panel.waitForTimeout(600);
  await expect(card).toContainText('फ़ील्ड 2 / 4');
  await panel.getByRole('button', { name: 'मूल फ़ील्ड पर जाएँ' }).click();
  await expect.poll(() => focusedControl(page)).toEqual({ id: '', value: 'two', form: 1 });

  // Identical twins in one form, one removed and the other replaced: no
  // stand-in is certain, so the person is told and nothing in the page is focused.
  await panel.getByRole('button', { name: 'जुड़वाँ' }).nth(1).click();
  await expect(card).toContainText('फ़ील्ड 4 / 4');
  await expect.poll(() => focusedControl(page)).toEqual({ id: '', value: 'twin-two', form: 2 });
  await page.evaluate(() => {
    const [first, second] = document.forms[2]!.elements as unknown as HTMLInputElement[];
    first!.parentElement!.remove();
    second!.replaceWith(second!.cloneNode(true));
  });
  await expect(readerStatus(panel)).toContainText('उसकी जगह तय नहीं हो सकी');
  await expect(card).toContainText('फ़ील्ड 1 / 3');
  expect(await focusedControl(page)).toBeNull();
  // The list still offers the surviving twin, and choosing it focuses exactly that control.
  await panel.getByRole('button', { name: 'जुड़वाँ' }).click();
  await expect(card).toContainText('फ़ील्ड 3 / 3');
  await expect.poll(() => focusedControl(page)).toEqual({ id: '', value: 'twin-two', form: 2 });

  // Removed without replacement: explained, and navigation keeps working.
  await panel.getByRole('button', { name: 'साझा नाम' }).first().click();
  await expect(card).toContainText('फ़ील्ड 1 / 3');
  await page.evaluate(() => document.forms[0]!.remove());
  await expect(readerStatus(panel)).toContainText('मौजूदा फ़ील्ड पेज से हट गया');
  await expect(readerStatus(panel)).toHaveText(/पेज में फ़ोकस नहीं बदला गया।$/);
  await expect(card).toContainText('फ़ील्ड 1 / 2');
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(card).toContainText('फ़ील्ड 2 / 2');
  await expect(card).toContainText('जुड़वाँ');
  await panel.close();
  await page.close();
});

test('audit regression: the reference, acknowledgment and snapshot end with their document, even through delayed callbacks', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  const referenceInput = panel.getByLabel('दस्तावेज़ में लिखी सटीक अंग्रेज़ी वर्तनी (वैकल्पिक)');
  const status = panel.getByRole('region', { name: 'स्थिति', exact: true });
  const acknowledge = panel.getByRole('button', { name: 'मैंने दिखाई गई समीक्षा पढ़ ली है' });

  await referenceInput.fill('ARUN DEV');
  await expect(panel.getByText(/फ़ॉर्म में “ARUN DE” है, आपके संदर्भ में “ARUN DEV”/).first()).toBeVisible();
  await acknowledge.click();
  await expect(status).toContainText('पढ़ने की स्वीकृति: दर्ज —');
  await panel.getByRole('button', { name: 'नाम — अंग्रेज़ी बड़े अक्षरों में (यदि दिया हो)' }).click();

  // A second acknowledgment is left waiting for its rescan while the tab navigates.
  await holdScans(panel);
  await acknowledge.click();
  await expect.poll(() => panel.evaluate(() => window.__scanReplies!.pending.length)).toBe(1);
  await page.goto(`${PRACTICE}/nsp.html?variant=a&case=issues`);
  await expect(readerStatus(panel)).toContainText('पेज फिर से लोड हुआ');
  expect(await panel.locator('body').innerText()).not.toContain('ARUN DE');
  await panel.evaluate(() => { window.__scanReplies!.hold = false; window.__scanReplies!.pending[0]!.resolve(); });
  await panel.waitForTimeout(300);
  expect(await panel.locator('body').innerText()).not.toContain('ARUN DE');
  await expect(readerStatus(panel)).toContainText('पेज फिर से लोड हुआ');

  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toBeVisible();
  await expect(referenceInput).toHaveValue('');
  await expect(status).toContainText('पढ़ने की स्वीकृति: दर्ज नहीं।');
  // The NSP name is compared to nothing: the ECI reference did not carry over.
  await expect(panel.getByText(/आपने कोई संदर्भ वर्तनी नहीं दी/).first()).toBeVisible();
  const text = await panel.locator('body').innerText();
  expect(text).not.toContain('ARUN DE');
  expect(text).not.toContain('स्वीकृति दर्ज नहीं हुई');
  await expect(panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' })).toContainText('फ़ील्ड 1 / 13');

  // Ordinary same-document work keeps the reference: a re-read is not a new document.
  await referenceInput.fill('KAVYA SAIN');
  await expect(panel.getByText(/फ़ॉर्म में “KAVYA SAI” है, आपके संदर्भ में “KAVYA SAIN”/).first()).toBeVisible();
  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toBeVisible();
  await expect(referenceInput).toHaveValue('KAVYA SAIN');
  await page.getByRole('radio', { name: 'शहरी' }).check();
  await expect(referenceInput).toHaveValue('KAVYA SAIN');

  // A reload is a new document too.
  await acknowledge.click();
  await expect(status).toContainText('पढ़ने की स्वीकृति: दर्ज —');
  await page.reload();
  await expect(readerStatus(panel)).toContainText('पेज फिर से लोड हुआ');
  await panel.getByRole('button', { name: 'फ़ॉर्म फिर पढ़ें' }).click();
  await expect(panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toBeVisible();
  await expect(referenceInput).toHaveValue('');
  await expect(status).toContainText('पढ़ने की स्वीकृति: दर्ज नहीं।');
  expect(await panel.locator('body').innerText()).not.toContain('KAVYA SAIN');

  // Closing the tab ends everything the panel held about it.
  await referenceInput.fill('KAVYA SAIN');
  await acknowledge.click();
  await expect(status).toContainText('पढ़ने की स्वीकृति: दर्ज —');
  await page.close();
  await expect(readerStatus(panel)).toContainText('जिस टैब की समीक्षा थी वह बंद हो गया');
  expect(await panel.locator('body').innerText()).not.toContain('KAVYA SAIN');
  await expect(panel.getByRole('button', { name: 'OTR संदर्भ (अभ्यास में आवश्यक)' })).toHaveCount(0);
  await panel.close();
});

test('audit regression: inactive choices keep their labels but no selection, value or checked state, in the snapshot and in a cloud payload', async () => {
  const page = await openPractice('/inactive-choices.html', `<!doctype html><html lang="hi"><head><meta charset="UTF-8"><title>Inactive choices</title></head><body>
    <fieldset id="conditional" hidden disabled>
      <legend>छिपा हुआ भाग</legend>
      <label for="hidden-select">छिपा चयन</label>
      <select id="hidden-select" name="hidden-select"><option value="choice-a">विकल्प क</option><option value="choice-b" selected>विकल्प ख</option></select>
      <label><input type="checkbox" id="hidden-check" name="hidden-check" value="ticked" checked>छिपा चेकबॉक्स</label>
      <fieldset><legend>छिपा रेडियो</legend>
        <label><input type="radio" name="hidden-radio" value="radio-a">एक</label>
        <label><input type="radio" name="hidden-radio" value="radio-b" checked>दो</label>
      </fieldset>
      <label for="hidden-text">छिपा पाठ</label><input id="hidden-text" name="hidden-text" value="INACTIVE-TEXT-MARKER">
    </fieldset>
    <label for="visible-text">दिखता पाठ</label><input id="visible-text" name="visible-text" value="VISIBLE-MARKER">
    <button id="show" type="button">दिखाएँ</button>
    <script>document.getElementById('show').onclick = () => { const part = document.getElementById('conditional'); part.hidden = false; part.disabled = false; };</script>
    </body></html>`);
  const panel = await openPanel(page);
  const tabId = await tabIdOf(page);
  const scan = async () => (await worker.evaluate(async (tab) => chrome.tabs.sendMessage(tab, { type: 'scan', tabId: tab }), tabId) as { snapshot: FormSnapshot }).snapshot;

  const hidden = await scan();
  const serialized = JSON.stringify(hidden);
  expect(serialized).not.toContain('INACTIVE-TEXT-MARKER');
  expect(serialized).not.toContain('"selected":true');
  expect(serialized).toContain('VISIBLE-MARKER');
  const inactive = hidden.fields.filter((field) => field.status === 'inactive');
  expect(inactive.map((field) => [field.key, field.label, field.value])).toEqual([
    ['hidden-select', 'छिपा चयन', null], ['hidden-check', 'छिपा चेकबॉक्स', null], ['hidden-radio', 'छिपा रेडियो', null], ['hidden-text', 'छिपा पाठ', null],
  ]);
  // Option metadata stays, for explaining the field; the person's choice does not.
  expect(inactive[0]?.options.map((option) => [option.label, option.selected])).toEqual([['विकल्प क', false], ['विकल्प ख', false]]);
  expect(inactive[2]?.options.map((option) => [option.label, option.selected])).toEqual([['एक', false], ['दो', false]]);
  expect(hidden.fields.find((field) => field.key === 'visible-text')?.value).toBe('VISIBLE-MARKER');
  await expect(fieldButton(panel, 'छिपा चयन')).toContainText('अभी लागू नहीं — यह फ़ील्ड छिपा या निष्क्रिय है।');
  await expect(panel.getByRole('table').getByRole('row', { name: /^छिपा चयन/ })).not.toContainText('विकल्प ख');

  // What a meaning request sends about an inactive choice: labels only, no selection.
  await enableCloud(panel);
  const payloads: string[] = [];
  await panel.route('**/v1/fields/interpret', async (route) => {
    payloads.push(route.request().postData() ?? '');
    await route.fulfill({ json: { interpretation: { outcome: 'unknown', explanation: 'अर्थ स्पष्ट नहीं है।' }, requiresConfirmation: true } });
  });
  await panel.getByRole('button', { name: 'छिपा चयन' }).click();
  await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
  await expect(panel.getByText('सेवा को अर्थ स्पष्ट नहीं लगा: अर्थ स्पष्ट नहीं है।')).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toContain('विकल्प ख');
  for (const marker of ['selected', 'choice-b', 'ticked', 'radio-b', 'INACTIVE-TEXT-MARKER', 'VISIBLE-MARKER', '"value"']) {
    expect(payloads[0]).not.toContain(marker);
  }

  // Once applicable again, the live values are read fresh.
  await page.getByRole('button', { name: 'दिखाएँ' }).click();
  await expect(fieldButton(panel, 'छिपा चयन')).toContainText('चुना गया: विकल्प ख');
  const shown = await scan();
  expect(shown.fields.map((field) => [field.key, field.status, field.value])).toEqual([
    ['hidden-select', 'read', 'choice-b'], ['hidden-check', 'read', 'ticked'], ['hidden-radio', 'read', 'radio-b'],
    ['hidden-text', 'read', 'INACTIVE-TEXT-MARKER'], ['visible-text', 'read', 'VISIBLE-MARKER'],
  ]);
  expect(shown.fields.find((field) => field.key === 'hidden-radio')?.options.map((option) => option.selected)).toEqual([false, true]);
  await panel.close();
  await page.close();
});
