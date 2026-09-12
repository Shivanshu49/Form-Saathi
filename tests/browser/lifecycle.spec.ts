import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
import type { FormSnapshot } from '@form-saathi/contracts';
import type {} from './reader-harness.js';

declare global {
  interface Window {
    __readerControl: {
      holdScans: boolean;
      holdInjections: boolean;
      pendingScans: { resolve: (snapshot: FormSnapshot) => void; reject: () => void }[];
      pendingInjections: (() => void)[];
      scansSent: number;
      navigate: () => void;
      close: () => void;
      push: (snapshot: FormSnapshot) => void;
    };
    __scanDone: (FormSnapshot | null)[];
  }
}

test.use({ channel: 'chromium' });
let harness = '';
const snapshot: FormSnapshot = { tabId: 7, documentId: 'nsp-document', sequence: 1, origin: 'http://127.0.0.1:3000', title: 'NSP', fields: [], gaps: [] };

test.beforeAll(async () => {
  const result = await build({
    configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, lib: { entry: resolve('tests/browser/reader-harness.ts'), name: 'ReaderHarness', formats: ['iife'] } },
  });
  const output = Array.isArray(result) ? result[0]! : result;
  if (!('output' in output)) throw new Error('Expected a test bundle');
  const chunk = output.output.find((file) => file.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing test bundle');
  harness = chunk.code;
});

async function openHarness(page: Page) {
  await page.addInitScript((initial) => {
    const event = () => {
      const listeners = new Set<(...args: unknown[]) => void>();
      return { addListener: (listener: (...args: unknown[]) => void) => listeners.add(listener),
        removeListener: (listener: (...args: unknown[]) => void) => listeners.delete(listener),
        fire: (...args: unknown[]) => { for (const listener of listeners) listener(...args); } };
    };
    const onMessage = event();
    const onUpdated = event();
    const onRemoved = event();
    const control: Window['__readerControl'] = {
      holdScans: false, holdInjections: false, pendingScans: [], pendingInjections: [], scansSent: 0,
      navigate: () => onUpdated.fire(7, { status: 'loading' }), close: () => onRemoved.fire(7),
      push: (next) => onMessage.fire({ type: 'snapshot', snapshot: next }, { id: 'test-extension', tab: { id: 7 } }),
    };
    window.__readerControl = control;
    window.__scanDone = [];
    Object.defineProperty(window, 'chrome', { configurable: true, value: {
      runtime: { id: 'test-extension', onMessage },
      scripting: { executeScript: () => control.holdInjections
        ? new Promise<void>((resolve) => control.pendingInjections.push(resolve)) : Promise.resolve() },
      tabs: { onUpdated, onRemoved, sendMessage: () => {
        control.scansSent += 1;
        if (!control.holdScans) return Promise.resolve({ type: 'snapshot', snapshot: initial });
        return new Promise((resolve, reject) => control.pendingScans.push({
          resolve: (next) => resolve({ type: 'snapshot', snapshot: next }), reject: () => reject(new Error('old scan failed')),
        }));
      } },
    } });
  }, snapshot);
  await page.route('http://127.0.0.1:3000/reader-harness', (route) => route.fulfill({
    contentType: 'text/html', body: '<html><body><div id="root"></div><script src="/reader-harness.js"></script></body></html>',
  }));
  await page.route('http://127.0.0.1:3000/reader-harness.js', (route) => route.fulfill({ contentType: 'text/javascript', body: harness }));
  await page.goto('http://127.0.0.1:3000/reader-harness');
  await expect(page.locator('#connection')).toContainText('"state":"ready"');
  await page.evaluate(() => { window.__readerControl.holdScans = true; });
}

const startScan = (page: Page) => page.evaluate(() => {
  void window.__readerHarness!.rescan().then((reply) => window.__scanDone.push(reply));
});

for (const ending of ['navigation', 'close', 'unmount'] as const) {
  test(`audit regression: a direct scan cannot survive ${ending}`, async ({ page }) => {
    await openHarness(page);
    await startScan(page);
    await expect.poll(() => page.evaluate(() => window.__readerControl.pendingScans.length)).toBe(1);
    await page.evaluate((kind) => {
      if (kind === 'navigation') window.__readerControl.navigate();
      else if (kind === 'close') window.__readerControl.close();
      else window.__unmountReader!();
    }, ending);
    await page.evaluate((next) => window.__readerControl.pendingScans[0]!.resolve(next), { ...snapshot, sequence: 2 });
    await expect.poll(() => page.evaluate(() => window.__scanDone)).toEqual([null]);
    if (ending === 'unmount') await expect(page.locator('#connection')).toHaveCount(0);
    else await expect(page.locator('#connection')).toHaveText(JSON.stringify({ state: ending === 'close' ? 'closed' : 'stale' }));
  });
}

for (const oldReply of ['success', 'failure', 'push'] as const) {
  test(`audit regression: a newer result wins over an old scan ${oldReply}`, async ({ page }) => {
    await openHarness(page);
    await startScan(page);
    await expect.poll(() => page.evaluate(() => window.__readerControl.pendingScans.length)).toBe(1);
    const newer = { ...snapshot, sequence: 3, title: 'NEWER' };
    if (oldReply === 'push') await page.evaluate((next) => window.__readerControl.push(next), newer);
    else {
      await startScan(page);
      await expect.poll(() => page.evaluate(() => window.__readerControl.pendingScans.length)).toBe(2);
      await page.evaluate((next) => window.__readerControl.pendingScans[1]!.resolve(next), newer);
    }
    await expect(page.locator('#connection')).toContainText('NEWER');
    await page.evaluate(({ next, failure }) => {
      if (failure) window.__readerControl.pendingScans[0]!.reject();
      else window.__readerControl.pendingScans[0]!.resolve(next);
    }, { next: { ...snapshot, sequence: 2, title: 'OBSOLETE' }, failure: oldReply === 'failure' });
    await expect.poll(() => page.evaluate(() => window.__scanDone.includes(null))).toBe(true);
    await expect(page.locator('#connection')).toContainText('NEWER');
    await expect(page.locator('#connection')).not.toContainText('OBSOLETE');
  });
}

test('audit regression: a late injection cannot send a scan after navigation or supersession', async ({ page }) => {
  await openHarness(page);
  await page.evaluate(() => { window.__readerControl.holdInjections = true; });
  await startScan(page);
  await startScan(page);
  await expect.poll(() => page.evaluate(() => window.__readerControl.pendingInjections.length)).toBe(2);
  await page.evaluate(() => window.__readerControl.pendingInjections[0]!());
  await expect.poll(() => page.evaluate(() => window.__scanDone)).toEqual([null]);
  await page.evaluate(() => { window.__readerControl.navigate(); window.__readerControl.pendingInjections[1]!(); });
  await expect.poll(() => page.evaluate(() => window.__scanDone)).toEqual([null, null]);
  expect(await page.evaluate(() => window.__readerControl.scansSent)).toBe(1);
  await expect(page.locator('#connection')).toHaveText('{"state":"stale"}');
});
