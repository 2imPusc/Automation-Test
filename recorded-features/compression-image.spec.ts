/**
 * @feature compression-image
 * @app Avada Plaza
 * @recorded Tester-recorded feature tests
 * @created 2026-03-26T09:31:09.860Z
 *
 * Tests recorded via Playwright Codegen in Autotest Web UI.
 * Each test case was recorded manually by a tester.
 */
import { test, expect } from '../fixtures';
import { t, tLoc } from '../helpers/locale';

test.describe('compression-image', () => {

  /**
   * click optimize
   * @recorded 2026-03-26T09:31:09.860Z
   */
  test('click optimize', async ({ imageManager }) => {
    await imageManager.waitForLoad();
    // Navigation handled by fixture
      await imageManager.page.getByRole('button', { name: 'hide' }).nth(1).click();
      await imageManager.page.getByRole('link', { name: 'Image optimizer' }).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().locator('.Polaris-TextField').click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByText('High - 80%').click();
      await imageManager.page.getByRole('button', { name: 'Save' }).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().locator('.Avada-Optimize-Button-suffix-wrapper > .Polaris-Icon > .Polaris-Icon__Svg').click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByRole('button', { name: 'Optimize all' }).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().locator('div').filter({ hasText: /^Optimize in progress$/ }).nth(2).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().locator('div').filter({ hasText: /^0%$/ }).nth(1).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByRole('heading', { name: 'Optimization in progress. Get' }).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByRole('button', { name: 'Notify me' }).click();
      await imageManager.page.getByText('We will send you an email').click();
  });

  /**
   * manual compression
   * @recorded 2026-03-26T09:35:55.369Z
   */
  test('manual compression', async ({ imageManager }) => {
    await imageManager.waitForLoad();
    // Navigation handled by fixture
      await imageManager.page.getByRole('button', { name: 'hide' }).nth(1).click();
      await imageManager.page.getByRole('link', { name: 'Image optimizer' }).click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByText('Optimize manually').click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().locator('[id="gid://shopify/MediaImage/39491228893432__Fileundefined"]').getByText('Not scanned').click();
      await imageManager.page.locator('iframe[name="app-iframe"]').contentFrame().getByRole('button', { name: 'Compress image' }).click();
      await imageManager.page.getByText('Image optimized successfully').click();
  });
});
