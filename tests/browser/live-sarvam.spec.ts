import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mintPilotToken } from '../../apps/api/dist/pilot-token.js';

// The complete extension → NestJS → Sarvam path: the installed extension in
// Chromium against the real service that Playwright starts from `.env`. Runs
// only under the `live` project (FORM_SAATHI_LIVE=1) with a server-side key
// configured; everything typed or spoken is fictional. With
// FORM_SAATHI_LIVE_AUDIO=<approved .wav>, the recording is real; otherwise
// only the transcription route is answered locally and every interpretation,
// meaning and help request goes to the provider. See docs/live-verification.md.

const PRACTICE = 'http://127.0.0.1:3000';
const FIXTURES = 'http://127.0.0.1:4173';
const UNAMBIGUOUS = 'पंद्रह अगस्त दो हज़ार';
const AMBIGUOUS = 'पंद्रह अगस्त';

function pilotSecret(): string {
  const fromEnv = process.env['PILOT_TOKEN_SECRET'];
  if (fromEnv) return fromEnv;
  const line = readFileSync(resolve('.env'), 'utf8').split('\n').find((candidate) => candidate.startsWith('PILOT_TOKEN_SECRET='));
  if (!line) throw new Error('PILOT_TOKEN_SECRET is not configured in .env; the live check cannot mint a pilot credential.');
  return line.slice('PILOT_TOKEN_SECRET='.length).trim().replace(/^["']|["']$/g, '');
}

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
let token: string;
const audioFile = process.env['FORM_SAATHI_LIVE_AUDIO'];

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test.beforeAll(async () => {
  token = mintPilotToken('live-browser-check', 1, pilotSecret());
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 420, height: 900 },
    args: [
      `--disable-extensions-except=${resolve('apps/extension/.output/chrome-mv3')}`,
      `--load-extension=${resolve('apps/extension/.output/chrome-mv3')}`,
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      ...(audioFile ? [`--use-file-for-fake-audio-capture=${resolve(audioFile)}%noloop`] : []),
    ],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => { await context.close(); });

function observed(description: string): void {
  test.info().annotations.push({ type: 'observed', description });
  console.log(`observed: ${description}`);
}

async function openPractice(path: string): Promise<Page> {
  const page = await context.newPage();
  await page.route(`${PRACTICE}/**`, async (route) => {
    await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(PRACTICE, FIXTURES) }) });
  });
  await page.goto(`${PRACTICE}${path}`);
  return page;
}

async function openPanel(page: Page): Promise<Page> {
  await page.bringToFront();
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.id);
  const panel = await context.newPage();
  // No read-aloud in this check: nothing may speak on its own.
  await panel.addInitScript(() => {
    chrome.tts.getVoices = () => Promise.resolve([]);
    chrome.tts.speak = () => Promise.resolve();
    chrome.tts.stop = () => undefined;
  });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}`);
  await panel.getByRole('combobox').first().selectOption('hi');
  await expect(panel.getByRole('status').first()).not.toHaveText('पेज पढ़ा जा रहा है…');
  for (const selector of ['.form-status details', '.review > details', '.reference', '.fields-disclosure']) {
    await panel.locator(selector).locator(':scope > summary').click();
  }
  return panel;
}

async function saveCredential(panel: Page, credential: string): Promise<void> {
  const settings = panel.getByRole('button', { name: 'सेटिंग्स', exact: true });
  if (await settings.getAttribute('aria-expanded') === 'false') await settings.click();
  if (await panel.getByRole('button', { name: 'क्लाउड सुविधा बंद करें' }).count() === 0) {
    await panel.getByRole('button', { name: 'समझ गया। क्लाउड सुविधा चालू करें' }).click();
  }
  await panel.getByLabel('पायलट क्रेडेंशियल').fill(credential);
  await panel.getByRole('button', { name: 'क्रेडेंशियल सहेजें' }).click();
  await expect(panel.getByText('क्रेडेंशियल सहेजा हुआ है।')).toBeVisible();
}

/** Records on the fake microphone (the approved file, or silence) and sends it. */
async function recordAndSend(panel: Page, seconds: number): Promise<void> {
  await panel.getByRole('button', { name: 'रिकॉर्डिंग शुरू करें' }).click();
  await expect(panel.getByText(/रिकॉर्डिंग चल रही है/)).toBeVisible();
  await panel.waitForTimeout(seconds * 1000);
  await panel.getByRole('button', { name: 'रोकें और भेजें' }).click();
}

test('live: a fictional spoken date becomes a suggestion the local rules check, and an ambiguous one asks for clarification', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  await saveCredential(panel, token);
  const transcript = panel.getByLabel('पाठ या टाइप किया उत्तर। भेजने से पहले सुधारें।');
  if (audioFile) {
    const started = Date.now();
    await recordAndSend(panel, 4);
    await expect(transcript).toBeVisible({ timeout: 60_000 });
    observed(`live transcription of the approved recording in ${Date.now() - started} ms (includes 4 s of recording): “${await transcript.inputValue()}”`);
  } else {
    // Only this route is answered locally; the provider still receives every interpretation below.
    await panel.route('**/v1/speech/transcribe', (route) => route.fulfill({ json: { transcript: UNAMBIGUOUS, languageCode: 'hi-IN', requiresConfirmation: true } }));
    await recordAndSend(panel, 1);
    await expect(transcript).toBeVisible();
    observed('transcription route answered locally (no FORM_SAATHI_LIVE_AUDIO supplied); interpretation, meaning and help go to the provider');
  }

  // Ambiguous: the person edits the transcript to drop the year.
  await transcript.fill(AMBIGUOUS);
  let started = Date.now();
  await panel.getByRole('button', { name: 'इस पाठ को समझें' }).click();
  const clarify = panel.locator('.speech-assist').getByText('स्पष्टीकरण चाहिए; कोई मान नहीं सुझाया गया।', { exact: true });
  const suggested = panel.getByText(/^सुझाया गया मान:/);
  await expect(clarify.or(suggested).or(panel.getByRole('button', { name: 'फिर से कोशिश करें' }))).toBeVisible({ timeout: 60_000 });
  observed(`“${AMBIGUOUS}” → ${await clarify.count() > 0 ? 'clarification, no value' : await suggested.count() > 0 ? `SUGGESTION “${await suggested.innerText()}” (a guessed year is a defect)` : 'failure'} in ${Date.now() - started} ms`);
  await expect(clarify).toBeVisible();
  await panel.getByRole('button', { name: 'पाठ सुधारें' }).click();

  // Unambiguous: the local rules check the suggestion before anyone applies it.
  await transcript.fill(UNAMBIGUOUS);
  started = Date.now();
  await panel.getByRole('button', { name: 'इस पाठ को समझें' }).click();
  await expect(suggested.or(clarify).or(panel.getByRole('button', { name: 'फिर से कोशिश करें' }))).toBeVisible({ timeout: 60_000 });
  const suggestion = await suggested.count() > 0 ? await suggested.locator('strong').innerText() : null;
  const check = await panel.getByText(/कोई कमी नहीं मिली। पुष्टि नहीं।|सुधार चाहिए:/).first().innerText().catch(() => 'no local check shown');
  observed(`“${UNAMBIGUOUS}” → ${suggestion === null ? 'no suggestion' : `“${suggestion}”`}; ${check}; in ${Date.now() - started} ms`);
  await expect(suggested).toBeVisible();
  await expect(panel.getByText('यह सुझाव है। इसे फ़ॉर्म में आप स्वयं भरेंगे; पैनल कुछ नहीं भरता।')).toBeVisible();
  // Nothing was written into the page.
  expect(await page.locator('#eci-dob').inputValue()).toBe('31/02/2000');
  await panel.close();
  await page.close();
});

test('live: a field meaning arrives as an unconfirmed guess and help audio as a playable clip', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  await saveCredential(panel, token);
  let started = Date.now();
  await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
  const guess = panel.locator('.speech-assist').getByText('सेवा का समझाया अर्थ', { exact: true });
  const unclear = panel.locator('.speech-assist').getByText('सेवा को इस फ़ील्ड का अर्थ स्पष्ट नहीं लगा।', { exact: true });
  await expect(guess).toBeVisible({ timeout: 60_000 });
  observed(`field meaning → ${await unclear.count() > 0 ? 'service found the meaning unclear' : 'unconfirmed explanation received'} in ${Date.now() - started} ms`);
  await expect(panel.getByText(/यह अनुमान है, पोर्टल का नियम नहीं/)).toBeVisible();

  started = Date.now();
  await panel.getByLabel('विषय').selectOption('navigation');
  await panel.getByRole('button', { name: 'सहायता का ऑडियो लाएँ' }).click();
  const player = panel.locator('audio');
  await expect(player).toBeVisible({ timeout: 60_000 });
  const duration = await player.evaluate((element) => new Promise<number>((done) => {
    const audio = element as HTMLAudioElement;
    if (Number.isFinite(audio.duration) && audio.duration > 0) done(audio.duration);
    else audio.addEventListener('loadedmetadata', () => done(audio.duration), { once: true });
  }));
  observed(`help audio ready in ${Date.now() - started} ms, duration ${duration.toFixed(1)} s`);
  expect(duration).toBeGreaterThan(0);
  await panel.close();
  await page.close();
});

test('live: an invalid credential fails usably and a valid one recovers without losing the keyboard path', async () => {
  const page = await openPractice('/eci-form6.html?variant=a&case=issues');
  const panel = await openPanel(page);
  await panel.getByRole('button', { name: 'जन्म तारीख (अभ्यास में आवश्यक)' }).click();
  await saveCredential(panel, 'fs1.not-a-valid-credential');
  await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
  await expect(panel.getByText(/पायलट क्रेडेंशियल मान्य नहीं है या समाप्त हो गया है/).first()).toBeVisible({ timeout: 30_000 });
  observed('invalid credential → the panel explains it and keeps navigation');
  await panel.getByRole('button', { name: 'अगला फ़ील्ड', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'मौजूदा फ़ील्ड' })).toContainText('फ़ील्ड 5 / 14');
  await panel.getByRole('button', { name: 'पिछला फ़ील्ड', exact: true }).click();
  await saveCredential(panel, token);
  await panel.getByRole('button', { name: 'इस फ़ील्ड का अर्थ पूछें' }).click();
  await expect(panel.locator('.speech-assist').getByText('सेवा का समझाया अर्थ', { exact: true })).toBeVisible({ timeout: 60_000 });
  observed('valid credential → the same request succeeds afterwards');
  await panel.close();
  await page.close();
});
