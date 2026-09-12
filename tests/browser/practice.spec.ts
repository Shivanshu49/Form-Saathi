import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Hand-authored expectations, independent of profiles.ts and any future validator.
// See fixtures/expected-results.md for meanings and evidence boundaries.
const exercises = [
  { workflow: 'nsp', path: 'nsp.html', variant: 'a', name: 'nsp-name',
    reference: 'KAVYA SAIN', wrongName: 'KAVYA SAI', dob: '15/08/2004', wrongDob: '31/02/2004',
    identifier: 'nsp-otr', correctId: '90000000000001', wrongId: '9000000000001',
    detail: 'nsp-locality-other', radio: 'nsp-locality', alternative: 'urban' },
  { workflow: 'nsp', path: 'nsp.html', variant: 'b', name: 'nsp-name',
    reference: 'NEHA DASS', wrongName: 'NEHA DAS', dob: '16/08/2005', wrongDob: '31/02/2005',
    identifier: 'nsp-otr', correctId: '90000000000002', wrongId: '9000000000002',
    detail: 'nsp-locality-other', radio: 'nsp-locality', alternative: 'urban' },
  { workflow: 'eci', path: 'eci-form6.html', variant: 'a', name: 'eci-name-en',
    reference: 'ARUN DEV', wrongName: 'ARUN DE', dob: '15/08/2000', wrongDob: '31/02/2000',
    identifier: 'eci-pin', correctId: '226001', wrongId: '22601',
    detail: 'eci-age-proof-other', radio: 'eci-age-proof', alternative: 'birth-certificate' },
  { workflow: 'eci', path: 'eci-form6.html', variant: 'b', name: 'eci-name-en',
    reference: 'AMAN ROY', wrongName: 'AMAN RO', dob: '16/08/2001', wrongDob: '31/02/2001',
    identifier: 'eci-pin', correctId: '208001', wrongId: '20801',
    detail: 'eci-age-proof-other', radio: 'eci-age-proof', alternative: 'birth-certificate' },
] as const;

for (const exercise of exercises) {
  for (const scenario of ['issues', 'complete'] as const) {
    test(`${exercise.workflow} ${exercise.variant} ${scenario}: fictional data, keyboard changes and coverage`, async ({ page, context }) => {
      const errors: string[] = [];
      const externalRequests: string[] = [];
      const nonGetRequests: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
        if (request.method() !== 'GET') nonGetRequests.push(request.method());
      });
      await page.goto(`/${exercise.path}?variant=${exercise.variant}&case=${scenario}`);
      await expect(page.getByText('केवल प्रदर्शन। यह सरकारी पोर्टल नहीं है।')).toBeVisible();
      await expect(page.getByText('लाइव समर्थन: असत्यापित', { exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
      await expect(page.locator('#reference-name')).toHaveText(exercise.reference);
      await expect(page.locator(`#${exercise.name}`)).toHaveValue(scenario === 'issues' ? exercise.wrongName : exercise.reference);
      await expect(page.locator(`#${exercise.workflow}-dob`)).toHaveValue(scenario === 'issues' ? exercise.wrongDob : exercise.dob);
      await expect(page.locator(`#${exercise.identifier}`)).toHaveValue(scenario === 'issues' ? exercise.wrongId : exercise.correctId);

      // Native metadata is inspected only for seeded presence/shape problems.
      // No calendar, identity, reference or portal validator is implied by this check.
      const missing = await page.locator('#practice-form input, #practice-form select').evaluateAll((controls) =>
        controls.filter((control) => (control instanceof HTMLInputElement || control instanceof HTMLSelectElement)
          && control.willValidate && control.validity.valueMissing).map((control) => control.id).sort());
      expect(missing).toEqual(scenario === 'issues' ? [exercise.detail, `${exercise.workflow}-district`].sort() : []);
      const badFormat = await page.locator('#practice-form input').evaluateAll((controls) =>
        controls.filter((control) => control instanceof HTMLInputElement && control.validity.patternMismatch).map((control) => control.id));
      expect(badFormat).toEqual(scenario === 'issues' ? [exercise.identifier] : []);

      if (exercise.workflow === 'nsp') {
        for (const id of ['nsp-name', 'nsp-dob', 'nsp-gender']) {
          await expect(page.locator(`#${id}`)).toHaveAttribute('readonly', '');
        }
      } else {
        await expect(page.locator('#eci-email')).toHaveValue('');
        await expect(page.locator('#eci-email')).not.toHaveAttribute('required');
        await page.locator('#eci-name-en').fill('');
        expect(await page.locator('#eci-name-en').evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(false);
        await page.locator('#eci-name-en').fill(exercise.reference);
      }
      await expect(page.locator(`#${exercise.workflow}-detail`)).toHaveValue(/^\d{12}$/);
      await expect(page.locator('#unsupported-frame')).toHaveAttribute('sandbox', '');
      await expect(page.frameLocator('#unsupported-frame').getByLabel('फ़्रेम में काल्पनिक टिप्पणी (वैकल्पिक)')).toBeVisible();
      expect(await page.locator('#unsupported-frame').evaluate((frame) => (frame as HTMLIFrameElement).contentDocument)).toBeNull();

      const accessibility = await new AxeBuilder({ page })
        // This deliberately unsupported opaque frame is outside our audited content.
        .exclude('#unsupported-frame')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(accessibility.violations).toEqual([]);

      // Native radio arrow keys hide an inapplicable required field and restore it.
      const other = page.locator(`input[name="${exercise.radio}"][value="other"]`);
      const alternative = page.locator(`input[name="${exercise.radio}"][value="${exercise.alternative}"]`);
      await other.focus();
      await other.press('ArrowLeft');
      await expect(alternative).toBeChecked();
      await expect(alternative).toBeFocused();
      const detail = page.locator(`#${exercise.detail}`);
      await expect(detail).toBeHidden();
      await expect(detail).toBeDisabled();
      expect(await detail.evaluate((input) => (input as HTMLInputElement).willValidate)).toBe(false);
      await alternative.press('ArrowRight');
      await expect(other).toBeChecked();
      await expect(other).toBeFocused();
      await expect(detail).toBeVisible();
      await expect(detail).toBeEnabled();
      await detail.fill('LOCAL_ONLY_SENTINEL');
      await other.press('ArrowLeft');
      await alternative.press('ArrowRight');
      await expect(detail).toHaveValue('LOCAL_ONLY_SENTINEL');

      const add = page.locator('#add-note');
      const note = page.locator(`#${exercise.workflow}-note`);
      await expect(note).toHaveCount(0);
      await add.focus();
      await add.press('Enter');
      await expect(add).toBeFocused();
      await add.press('Space');
      await expect(note).toHaveCount(1);
      await page.keyboard.press('Tab');
      await expect(note).toBeFocused();
      await note.fill('LOCAL_ONLY_SENTINEL');
      await expect(note).not.toHaveAttribute('required');
      if (exercise.variant === 'a' && scenario === 'issues') {
        const updatedAccessibility = await new AxeBuilder({ page }).exclude('#unsupported-frame')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(updatedAccessibility.violations).toEqual([]);
      }
      await page.keyboard.press('Enter');
      await page.locator('#practice-form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
      await expect(page.locator('#practice-status')).toHaveText('यह अभ्यास पृष्ठ है। कोई आवेदन नहीं भेजा जाता।');
      expect(page.url()).not.toContain('LOCAL_ONLY_SENTINEL');
      await expect(page.locator('button[type="submit"], input[type="submit"]')).toHaveCount(0);
      expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
      expect((await context.storageState()).cookies).toEqual([]);

      await page.locator('#reset-profile').press('Enter');
      await expect(note).toHaveCount(0);
      await expect(page.locator(`#${exercise.name}`)).toHaveValue(scenario === 'issues' ? exercise.wrongName : exercise.reference);
      await expect(detail).not.toHaveValue('LOCAL_ONLY_SENTINEL');
      await page.locator('#variant').selectOption(exercise.variant === 'a' ? 'b' : 'a');
      await page.locator('#scenario').selectOption('complete');
      await page.locator('#load-profile').press('Enter');
      await expect(page).toHaveURL(new RegExp(`variant=${exercise.variant === 'a' ? 'b' : 'a'}&case=complete$`));
      expect(errors).toEqual([]);
      expect(externalRequests).toEqual([]);
      expect(nonGetRequests).toEqual([]);
    });
  }
}

test('practice index links work and narrow pages retain keyboard access', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  const paths = await page.locator('main a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
  expect(paths).toEqual(['/nsp.html', '/nsp.html', '/eci-form6.html', '/eci-form6.html']);
  await page.getByRole('link', { name: 'NSP अभ्यास A खोलें' }).click();
  await expect(page.locator('#reference-name')).toHaveText('KAVYA SAIN');
  await page.goto('/eci-form6.html?variant=unknown&case=unknown');
  await expect(page.locator('#reference-name')).toHaveText('ARUN DEV');
  await expect(page.locator('#scenario')).toHaveValue('issues');
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'अभ्यास फ़ॉर्म पर जाएँ' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#practice-form')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#eci-name-hi')).toBeFocused();
});
