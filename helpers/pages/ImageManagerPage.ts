import { Page, FrameLocator, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Avada Plaza Image Manager page.
 * Encapsulates all selectors and actions for image compression workflows.
 *
 * Usage:
 *   const frame = await goToApp(page, APPS.avadaPlaza.handle);
 *   const imageManager = new ImageManagerPage(page, frame);
 *   await imageManager.goTo();
 */
export class ImageManagerPage extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  /** Toast / alert notification element */
  get toast(): Locator {
    return this.frame.locator([
      '[role="alert"]',
      '[class*="toast" i]',
      '[class*="Toast" i]',
      '[class*="notification" i]',
      '[class*="snackbar" i]',
    ].join(', ')).first();
  }

  /** Progress bar element */
  get progress(): Locator {
    return this.frame.locator([
      '[role="progressbar"]',
      '[class*="progress" i]',
      '[class*="Progress" i]',
    ].join(', ')).first();
  }

  /** Skeleton / loading placeholder element */
  get skeleton(): Locator {
    return this.frame.locator([
      '[class*="skeleton" i]',
      '[class*="Skeleton" i]',
      '[class*="loading" i]',
      '[aria-busy="true"]',
    ].join(', ')).first();
  }

  /** The "Compress image" action button */
  get compressButton(): Locator {
    return this.frame.getByRole('button', { name: 'Compress image' });
  }

  /** The "Optimize all" action button */
  get optimizeAllButton(): Locator {
    return this.frame.getByRole('button', { name: 'Optimize all' });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Close the Shopify Sidekick panel if it is open.
   * Sidekick can auto-open and obscure the app UI.
   */
  async closeShopifySidekick(): Promise<void> {
    return this.step('ImageManager: close Shopify Sidekick if open', async () => {
      const sidekick = this.page.getByRole('button', { name: 'Close Sidekick' });
      const hideBtns = this.page.getByRole('button', { name: 'hide' });

      if (await sidekick.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sidekick.click();
      } else if (await hideBtns.nth(1).isVisible({ timeout: 2000 }).catch(() => false)) {
        await hideBtns.nth(1).click();
      }
    });
  }

  /**
   * Navigate to the Image Manager section via the Shopify Admin nav link.
   * Assumes the app is already open (goToApp was called externally).
   */
  async goTo(): Promise<void> {
    return this.step('ImageManager: navigate to Image Manager', async () => {
      await this.closeShopifySidekick();
      await this.page.getByRole('link', { name: 'Image manager' }).click();
      await this.waitForLoad();
    });
  }

  /**
   * Wait for the Image Manager content to finish loading.
   */
  async waitForLoad(): Promise<void> {
    return this.step('ImageManager: wait for content to load', async () => {
      await this.frame.getByText('Optimize now').waitFor({ state: 'visible', timeout: 20000 });
    });
  }

  /**
   * Click the "Optimize now" button to open the optimize panel.
   */
  async clickOptimizeNow(): Promise<void> {
    return this.step('ImageManager: click Optimize now', async () => {
      await this.frame.getByText('Optimize now').click();
    });
  }

  /**
   * Click the "Optimize all" button to start auto optimization.
   */
  async clickOptimizeAll(): Promise<void> {
    return this.step('ImageManager: click Optimize all', async () => {
      await this.optimizeAllButton.click();
    });
  }

  /**
   * Switch the Image Manager to manual compress mode.
   */
  async switchToManualMode(): Promise<void> {
    return this.step('ImageManager: switch to manual mode', async () => {
      await this.frame.getByText('Optimize manually').click();
    });
  }

  /**
   * Select the first image in the image list by clicking its row checkbox.
   */
  async selectFirstImage(): Promise<void> {
    return this.step('ImageManager: select first image', async () => {
      const firstImageCheckbox = this.frame.getByRole('cell', { name: 'Select Item' }).first();
      await firstImageCheckbox.waitFor({ state: 'visible', timeout: 10000 });
      await firstImageCheckbox.click();
    });
  }

  /**
   * Click the "Compress image" button.
   */
  async clickCompressImage(): Promise<void> {
    return this.step('ImageManager: click Compress image', async () => {
      await this.compressButton.click();
    });
  }

  /**
   * Wait for the skeleton loading indicator to disappear.
   * @param timeout - Timeout in ms (default: 60000 to allow slow compress operations)
   */
  async waitForSkeletonGone(timeout = 60000): Promise<void> {
    return this.step('ImageManager: wait for skeleton to disappear', async () => {
      await this.waitForHidden(this.skeleton, timeout);
    });
  }
}
