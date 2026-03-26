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
import { t, tRegex, tLoc } from '../locale';  // ← REQUIRED

export class SettingsPage extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ✅ Use tLoc() for text-based locators — works in any locale
  get saveButton(): Locator {
    return this.frame.locator(tLoc('UseModal.toast.save')).first()
      // Fallback to role-based if i18n key not available
      ?? this.frame.getByRole('button', { name: tRegex('UseModal.toast.save') });
  }

  get successToast(): Locator {
    return this.frame.locator('[role="alert"], [class*="toast" i]').first();
  }

  get compressionQualityInput(): Locator {
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
import { test, expect } from '../../fixtures';
import { t, tLoc } from '../../helpers/locale';  // ← REQUIRED — no bare strings allowed

test.describe('Avada Plaza - Settings', () => {
  test('Settings page loads correctly @smoke', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — use Page Object locator (already uses tLoc internally)
    await expect(imageManager.frame.locator(tLoc('UseModal.toast.save'))).toBeVisible();
    console.log('✅ Settings page loaded');
  });

  test('Save settings → success toast appears', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — Page Object action method
    await imageManager.clickOptimizeNow();

    // ✅ CORRECT — t() resolves to locale-specific text
    await expect(imageManager.toast).toBeVisible({ timeout: 10000 });
    await expect(imageManager.toast).toContainText(t('UseModal.toast.save'));
    console.log('✅ Success toast appeared');
  });

  test('Statistics labels display correctly', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — t() for getByText, not bare strings
    await expect(
      imageManager.frame.getByText(t('Report.Tooltip.TotalImage'), { exact: false })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      imageManager.frame.getByText(t('Report.Tooltip.OriginalSize'), { exact: false })
    ).toBeVisible({ timeout: 10000 });
    console.log('✅ Statistics labels visible in current locale');
  });
});
```
