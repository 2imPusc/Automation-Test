import { Page, FrameLocator, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { t, tRegex, tLoc } from '../locale';

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

  // ── Locale-aware locators ───────────────────────────────────────────────
  // Uses t()/tRegex() from helpers/locale.ts — auto-resolves to store locale.
  // Set TEST_LOCALE=de (or fr, vi, etc.) to test a specific language.

  /** The "Optimize now" main CTA button */
  get optimizeNowButton(): Locator {
    return this.frame.locator(tLoc('ButtonOptimize.labelOtm')).first();
  }

  /** The "Compress image" action button (manual mode) */
  get compressButton(): Locator {
    return this.frame.locator(tLoc('ManualCompression.Compress')).first();
  }

  /** The "Optimize all" dropdown option */
  get optimizeAllButton(): Locator {
    return this.frame.locator(tLoc('ButtonOptimize.optionAll')).first();
  }

  /** The "Optimize manually" mode switcher */
  get manualOptimizeButton(): Locator {
    return this.frame.locator(tLoc('Optimizer.OptimizeManually')).first();
  }

  /** Empty state — no images to optimize */
  get emptyState(): Locator {
    return this.frame.locator('text=/no images|keine Bilder|aucune image/i').first();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Close the Shopify Sidekick panel and Dev Console if they are open.
   * These overlays can obscure the app UI and cause [disabled] state on nav links.
   */
  async closeShopifyOverlays(): Promise<void> {
    return this.step('ImageManager: close Shopify overlays (Sidekick, DevConsole)', async () => {
      // 1. Force-close ALL dialogs (Sidekick, etc.) via JS
      //    Sidekick has no close button — must use dialog.close() API
      await this.page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => {
          (d as HTMLDialogElement).close();
        });
        // Fallback: remove from DOM if close() didn't work
        document.querySelectorAll('dialog').forEach(d => {
          if (d.hasAttribute('open')) d.remove();
        });
      });

      // 2. Close Dev Console overlay
      const devConsoleClose = this.page.getByRole('button', { name: 'Close Dev Console' });
      if (await devConsoleClose.isVisible({ timeout: 1500 }).catch(() => false)) {
        await devConsoleClose.click();
      }
    });
  }

  /**
   * Navigate to the Image Manager page.
   * 
   * Strategy: Navigate directly via URL instead of clicking sidebar nav links.
   * Shopify's embedded app nav links are often [disabled] due to Dev Console
   * or app loading state, making click-based nav unreliable.
   * 
   * The URL pattern is: /store/{store}/apps/{handle}/embed/image-manager
   * We extract the app handle from the current URL or use the known handle.
   */
  async goTo(): Promise<void> {
    return this.step('ImageManager: navigate to Image Manager', async () => {
      await this.closeShopifyOverlays();

      // Extract app handle from current page URL
      const currentUrl = this.page.url();
      const handleMatch = currentUrl.match(/\/apps\/([^/]+)/);
      const appHandle = handleMatch?.[1] || '';

      if (appHandle) {
        // Direct URL navigation — most reliable
        const storeHandle = process.env.STORE_HANDLE || 'dophuc-store';
        const targetUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${appHandle}/embed/image-manager`;
        await this.page.goto(targetUrl);
        await this.page.waitForSelector('iframe[name="app-iframe"]', { timeout: 30000 });
      } else {
        // Fallback: try clicking nav link
        const navLink = this.page.getByRole('link', { name: /image (manager|optimizer)/i }).first();
        await navLink.waitFor({ state: 'visible', timeout: 15000 });
        await navLink.click({ force: true }); // force bypasses disabled state
      }

      await this.waitForLoad();
    });
  }

  /**
   * Wait for the Image Manager content to finish loading.
   * Detects the page title or optimize button in any locale.
   */
  async waitForLoad(): Promise<void> {
    return this.step('ImageManager: wait for content to load', async () => {
      // Wait for page title or optimize button (any locale)
      const title = tRegex('ImageManager.title');
      const btn = tRegex('ButtonOptimize.labelOtm');
      await this.frame.locator(`text=/${title.source}|${btn.source}/i`).first()
        .waitFor({ state: 'visible', timeout: 20000 });
    });
  }

  /**
   * Click the "Optimize now" / "Jetzt optimieren" button.
   */
  async clickOptimizeNow(): Promise<void> {
    return this.step('ImageManager: click Optimize now', async () => {
      await this.optimizeNowButton.click();
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
      await this.manualOptimizeButton.click();
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

  // ── Locators (v2 additions) ───────────────────────────────────────────────

  /** Modal/dialog element */
  get dialog(): Locator {
    return this.frame.locator('[role="dialog"]');
  }

  /** Image compare table inside the compression page */
  get compareTable(): Locator {
    return this.frame.locator('table').first();
  }

  /** Banner (info/success) element — used for progress and result banners */
  get banner(): Locator {
    return this.frame.locator('[class*="Banner" i], [role="status"]').first();
  }

  /** Filter bar / IndexFilters area */
  get filterBar(): Locator {
    return this.frame.locator('.Avada-ImageManager-Filter, [class*="IndexFilters"]').first();
  }

  /** Image table rows (actual data rows, not header) */
  get imageTableRows(): Locator {
    return this.frame.locator('table tbody tr, [class*="IndexTable"] [class*="Row"]');
  }

  /** Before/after image compare view */
  get imageCompareView(): Locator {
    return this.frame.locator(
      '[class*="compare" i], [class*="Compare" i], [class*="ImageView" i]'
    ).first();
  }

  // ── Actions (v2 additions) ────────────────────────────────────────────────

  /**
   * Navigate to the Image Compare / Compression sub-page.
   */
  async goToCompression(): Promise<void> {
    return this.step('ImageManager: navigate to compression page', async () => {
      await this.goTo();
      // Switch to Compression tab inside the iframe
      const compressionLink = this.frame.getByRole('link', { name: /compression/i });
      if (await compressionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await compressionLink.click();
      }
      await this.waitForSkeletonGone();
    });
  }

  /**
   * Trigger "Optimize all" flow: click Optimize now → Optimize all.
   */
  async triggerOptimizeAll(): Promise<void> {
    return this.step('ImageManager: trigger Optimize all', async () => {
      await this.clickOptimizeNow();
      await this.clickOptimizeAll();
    });
  }

  /**
   * Find the first unoptimized image row and click its optimize button.
   */
  async clickPerRowOptimize(): Promise<void> {
    return this.step('ImageManager: click per-row optimize button', async () => {
      const optimizeBtn = this.frame
        .locator('tr')
        .filter({ hasNot: this.frame.locator('[class*="optimized" i]') })
        .getByRole('button', { name: /optimize/i })
        .first();
      await optimizeBtn.waitFor({ state: 'visible', timeout: 15000 });
      await optimizeBtn.click();
    });
  }

  /**
   * Select images via checkbox in the compression image list.
   * Clicks the first N checkboxes found in the image list.
   */
  async selectImages(count = 1): Promise<void> {
    return this.step(`ImageManager: select ${count} image(s) via checkbox`, async () => {
      const checkboxes = this.frame.locator('input[type="checkbox"]');
      await checkboxes.first().waitFor({ state: 'visible', timeout: 10000 });
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).click();
      }
    });
  }

  /**
   * Click an already-optimized image row to open the compare view.
   */
  async clickOptimizedImageRow(): Promise<void> {
    return this.step('ImageManager: click optimized image row', async () => {
      const optimizedRow = this.frame
        .locator('tr, [class*="Row"]')
        .filter({ has: this.frame.getByText(/optimized/i) })
        .first();
      await optimizedRow.waitFor({ state: 'visible', timeout: 15000 });
      await optimizedRow.click();
    });
  }

  /**
   * Navigate away from Image Manager to trigger leave prompt.
   * Clicks the "Speed up" nav link (or first available nav link).
   */
  async navigateAway(): Promise<void> {
    return this.step('ImageManager: navigate away to trigger leave prompt', async () => {
      // Try Shopify Admin nav links (always present)
      const homeLink = this.page.getByRole('link', { name: 'Home' });
      const settingsLink = this.page.getByRole('link', { name: 'Settings' });

      if (await homeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await homeLink.click();
      } else if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsLink.click();
      } else {
        // Last resort: navigate via URL
        await this.page.goto(`https://admin.shopify.com/store/${process.env.STORE_HANDLE || 'dophuc-store'}`);
      }
    });
  }
}
