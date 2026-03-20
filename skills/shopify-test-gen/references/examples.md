# Examples

## Example 1 — Settings page

**Input:**
```
App: Avada Plaza
Trang: Settings
Flow: mở trang Settings, kiểm tra fields hiển thị, lưu, kiểm tra toast thành công
```

**Output — `helpers/pages/SettingsPage.ts`:**
```typescript
import { Page, FrameLocator, Locator } from '@playwright/test';
import { test } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  get saveButton(): Locator {
    return this.frame.getByRole('button', { name: 'Save' });
  }

  get successToast(): Locator {
    return this.frame.locator('[role="alert"], [class*="toast" i]').first();
  }

  get compressionQualityInput(): Locator {
    // TODO: verify selector
    return this.frame.locator('input[type="range"], input[name*="quality" i]').first();
  }

  async goTo(): Promise<void> {
    await test.step('SettingsPage: navigate', async () => {
      await this.page.getByRole('link', { name: 'Settings' }).click();
      await this.waitForLoad();
    });
  }

  async waitForLoad(): Promise<void> {
    await this.saveButton.waitFor({ state: 'visible', timeout: 20000 });
  }

  async clickSave(): Promise<void> {
    await test.step('SettingsPage: click Save', async () => {
      await this.saveButton.click();
    });
  }
}
```

**Output — `tests/avada-plaza/settings.spec.ts`:**
```typescript
/**
 * Avada Plaza - Settings Tests
 */
import { test, expect } from '@playwright/test';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';
import { SettingsPage } from '../../helpers/pages/SettingsPage';

test.describe('Avada Plaza - Settings', () => {
  test('Settings page loads correctly @smoke', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const settings = new SettingsPage(page, frame);
    await settings.goTo();

    await expect(settings.saveButton).toBeVisible();
    await expect(settings.compressionQualityInput).toBeVisible();
    console.log('✅ Settings page loaded');
  });

  test('Save settings → success toast appears', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const settings = new SettingsPage(page, frame);
    await settings.goTo();

    await settings.clickSave();
    await expect(settings.successToast).toBeVisible({ timeout: 10000 });
    console.log('✅ Success toast appeared');
  });
});
```
