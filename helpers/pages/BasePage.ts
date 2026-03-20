import { Page, FrameLocator, Locator } from '@playwright/test';

/**
 * Base Page Object providing common Playwright helpers for Shopify embedded apps.
 * All page objects should extend this class.
 */
export class BasePage {
  /** The Playwright Page instance (Shopify Admin shell) */
  readonly page: Page;

  /** FrameLocator targeting the embedded app iframe */
  readonly frame: FrameLocator;

  constructor(page: Page, frame: FrameLocator) {
    this.page = page;
    this.frame = frame;
  }

  /**
   * Wait for a locator to become visible.
   * @param locator - The locator to wait for
   * @param timeout - Timeout in ms (default: 15000)
   */
  async waitForVisible(locator: Locator, timeout = 15000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for a locator to become hidden.
   * @param locator - The locator to wait for
   * @param timeout - Timeout in ms (default: 15000)
   */
  async waitForHidden(locator: Locator, timeout = 15000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Click a button inside the app iframe by its accessible name.
   * @param name - Button accessible name (string or regex)
   */
  async clickButton(name: string | RegExp): Promise<void> {
    await this.frame.getByRole('button', { name }).click();
  }
}
