import { Page, FrameLocator, Locator } from '@playwright/test';
import { test } from '@playwright/test';
import { BasePage } from '../../helpers/pages/BasePage';

/**
 * Page Object cho trang Settings của Avada Plaza.
 */
export class SettingsPage extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  get saveButton(): Locator {
    return this.frame.getByRole('button', { name: 'Save' });
  }

  get successToast(): Locator {
    return this.frame.locator('[role="alert"], [class*="toast" i]').first();
  }

  get compressionQualityInput(): Locator {
    // TODO: verify selector — có thể là input[type="range"] hoặc input[type="number"]
    return this.frame.locator('input[type="range"], input[name*="quality" i]').first();
  }

  get autoOptimizeToggle(): Locator {
    return this.frame.getByRole('checkbox', { name: /auto.?optimiz/i });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goTo(): Promise<void> {
    await test.step('SettingsPage: navigate to Settings', async () => {
      await this.page.getByRole('link', { name: 'Settings' }).click();
      await this.waitForLoad();
    });
  }

  async waitForLoad(): Promise<void> {
    await this.frame.getByRole('button', { name: 'Save' })
      .waitFor({ state: 'visible', timeout: 20000 });
  }

  async clickSave(): Promise<void> {
    await test.step('SettingsPage: click Save', async () => {
      await this.saveButton.click();
    });
  }

  async waitForSuccessToast(): Promise<void> {
    await test.step('SettingsPage: wait for success toast', async () => {
      await this.waitForVisible(this.successToast, 10000);
    });
  }
}
