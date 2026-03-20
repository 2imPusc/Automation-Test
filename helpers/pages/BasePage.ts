import { test, Page, FrameLocator, Locator } from '@playwright/test';

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
   * Wrap an async action in a named Playwright test step for better HTML report output.
   * @param name - Step name shown in the Playwright HTML report
   * @param fn - Async action to execute inside the step
   */
  protected async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return test.step(name, fn);
  }

  /**
   * Wait for a locator to become visible.
   * Throws a descriptive error on timeout instead of a generic Playwright error.
   * @param locator - The locator to wait for
   * @param timeout - Timeout in ms (default: 15000)
   */
  async waitForVisible(locator: Locator, timeout = 15000): Promise<void> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
    } catch {
      throw new Error(`[${this.constructor.name}] waitForVisible timed out after ${timeout}ms`);
    }
  }

  /**
   * Wait for a locator to become hidden.
   * Throws a descriptive error on timeout instead of a generic Playwright error.
   * @param locator - The locator to wait for
   * @param timeout - Timeout in ms (default: 15000)
   */
  async waitForHidden(locator: Locator, timeout = 15000): Promise<void> {
    try {
      await locator.waitFor({ state: 'hidden', timeout });
    } catch {
      throw new Error(`[${this.constructor.name}] waitForHidden timed out after ${timeout}ms`);
    }
  }

  /**
   * Click a button inside the app iframe by its accessible name.
   * @param name - Button accessible name (string or regex)
   */
  async clickButton(name: string | RegExp): Promise<void> {
    await this.frame.getByRole('button', { name }).click();
  }
}
