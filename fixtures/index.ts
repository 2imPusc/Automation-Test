/**
 * Custom Playwright fixtures for Shopify app testing.
 *
 * Import `test` and `expect` from this file instead of `@playwright/test`
 * to get access to the pre-configured app fixtures.
 *
 * @example
 *   import { test, expect } from '../../fixtures';
 *
 *   test('shows correct info', async ({ imageManager }) => {
 *     await expect(imageManager.frame.getByText('Total images')).toBeVisible();
 *   });
 */
import { test as base, expect } from '@playwright/test';
import { goToApp } from '../helpers/shopify';
import { APPS } from '../helpers/apps';
import { ImageManagerPage } from '../helpers/pages/ImageManagerPage';
import { loadLocale } from '../helpers/locale';

/** Fixture types added on top of Playwright's built-in fixtures. */
type AppFixtures = {
  /** Pre-navigated ImageManagerPage instance, ready to use in tests. */
  imageManager: ImageManagerPage;
};

/**
 * Extended Playwright `test` with custom app fixtures.
 *
 * The `imageManager` fixture:
 *  1. Navigates to the Avada Plaza app via `goToApp`
 *  2. Creates an `ImageManagerPage` instance
 *  3. Calls `imageManager.goTo()` to navigate to the Image Manager section
 *  4. Yields the ready-to-use page object
 */
export const test = base.extend<AppFixtures>({
  imageManager: async ({ page }, use) => {
    // Auto-load locale for the app (TEST_LOCALE env var or default 'en')
    loadLocale('avadaPlaza', process.env.TEST_LOCALE);
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const imageManager = new ImageManagerPage(page, frame);
    await imageManager.goTo();
    await use(imageManager);
  },
});

export { expect } from '@playwright/test';
