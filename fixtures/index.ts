/**
 * Custom Playwright fixtures for Shopify app testing.
 *
 * Import `test` and `expect` from this file instead of `@playwright/test`
 * to get access to the pre-configured app fixtures.
 *
 * ## App-level fixtures (navigate to app home, return FrameLocator)
 * Use these when writing tests for a specific app. Each fixture navigates
 * to the app's home page and returns a FrameLocator for the embedded iframe.
 * Navigate to the specific section via a Page Object's goTo() method in your test.
 *
 * @example
 *   import { test, expect } from '../../fixtures';
 *
 *   // App-level fixture — navigate to section via POM
 *   test('SEO checklist', async ({ seoFrame, page }) => {
 *     const seoPage = new SeoChecklistPage(page, seoFrame);
 *     await seoPage.goTo();
 *     await expect(seoFrame.getByText('SEO Checklist')).toBeVisible();
 *   });
 *
 *   // Pre-navigated POM fixture (backward compat)
 *   test('shows correct info', async ({ imageManager }) => {
 *     await expect(imageManager.frame.getByText('Total images')).toBeVisible();
 *   });
 */
import { test as base, expect, FrameLocator } from '@playwright/test';
import { goToApp } from '../helpers/shopify';
import { APPS } from '../helpers/apps';
import { ImageManagerPage } from '../helpers/pages/ImageManagerPage';
import { loadLocale } from '../helpers/locale';

/** Fixture types added on top of Playwright's built-in fixtures. */
type AppFixtures = {
  /** FrameLocator for Avada Plaza app — navigates to app home only. */
  avadaPlazaFrame: FrameLocator;
  /** FrameLocator for SEO app — navigates to app home only. */
  seoFrame: FrameLocator;
  /** FrameLocator for Blogs app — navigates to app home only. */
  blogsFrame: FrameLocator;
  /** Pre-navigated ImageManagerPage instance, ready to use in tests. */
  imageManager: ImageManagerPage;
};

/**
 * Extended Playwright `test` with custom app fixtures.
 */
export const test = base.extend<AppFixtures>({
  /**
   * Navigates to Avada Plaza app home and returns the iframe FrameLocator.
   * Use this fixture when writing new tests for any Avada Plaza page.
   * Navigate to a specific section by calling goTo() on your Page Object.
   */
  avadaPlazaFrame: async ({ page }, use) => {
    loadLocale('avadaPlaza', process.env.TEST_LOCALE);
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    await use(frame);
  },

  /**
   * Navigates to SEO app home and returns the iframe FrameLocator.
   * Use this fixture when writing new tests for any SEO app page.
   */
  seoFrame: async ({ page }, use) => {
    loadLocale('seo', process.env.TEST_LOCALE);
    const frame = await goToApp(page, APPS.seo.handle);
    await use(frame);
  },

  /**
   * Navigates to Blogs app home and returns the iframe FrameLocator.
   * Use this fixture when writing new tests for any Blogs app page.
   */
  blogsFrame: async ({ page }, use) => {
    loadLocale('blogs', process.env.TEST_LOCALE);
    const frame = await goToApp(page, APPS.blogs.handle);
    await use(frame);
  },

  /**
   * Pre-navigated ImageManagerPage instance (backward compatible).
   *  1. Navigates to Avada Plaza app via goToApp
   *  2. Calls imageManager.goTo() to navigate to the Image Manager section
   *  3. Yields the ready-to-use page object
   */
  imageManager: async ({ page }, use) => {
    loadLocale('avadaPlaza', process.env.TEST_LOCALE);
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const imageManager = new ImageManagerPage(page, frame);
    await imageManager.goTo();
    await use(imageManager);
  },
});

export { expect } from '@playwright/test';
