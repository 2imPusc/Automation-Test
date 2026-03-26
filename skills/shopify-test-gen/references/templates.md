# Templates

## Page Object template

```typescript
import { Page, FrameLocator, Locator } from '@playwright/test';
import { test } from '@playwright/test';
import { BasePage } from './BasePage';
import { t, tRegex, tLoc } from '../locale';   // ← ALWAYS import locale helpers

/**
 * Page Object for [Page Name] of [App Name].
 */
export class [PageName]Page extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ── Locators ──────────────────────────────────────────────────────────────
  // ⚠️ RULE: NEVER hardcode UI text. Always use tLoc()/tRegex()/t() so locators
  //          work in any language (en, de, fr, vi, ...).

  /** Primary CTA button — prefer role-based selector over text match.
   * Decision: getByRole > Avada class > tLoc (see selector decision tree in code-writer.md)
   */
  get primaryButton(): Locator {
    // Option A (best): if data-testid exists
    // return this.frame.getByTestId('primary-cta');
    // Option B (good): role + i18n name
    return this.frame.getByRole('button', { name: tRegex('[i18n.key.for.button.label]') });
    // Option C (good): Avada custom class
    // return this.frame.locator('.Avada-ComponentName').first();
    // Option D (last resort): tLoc — MUST use .first()
    // return this.frame.locator(tLoc('[i18n.key.for.button.label]')).first();
  }

  /** Success toast / alert — target inner [role="alert"], NOT the wrapper */
  get successToast(): Locator {
    return this.frame.locator('.Polaris-Frame-ToastManager [role="alert"]').first();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goTo(): Promise<void> {
    await test.step('[PageName]: navigate', async () => {
      await this.page.getByRole('link', { name: 'Nav Label' }).click();
      await this.waitForLoad();
    });
  }

  async waitForLoad(): Promise<void> {
    // Use getByRole('heading') — NOT getByText (avoids hidden Polaris span matches)
    await this.frame
      .getByRole('heading', { name: tRegex('[i18n.key.for.page.title]') })
      .waitFor({ state: 'visible', timeout: 20000 });
  }

  async clickPrimary(): Promise<void> {
    await test.step('[PageName]: click primary action', async () => {
      await this.primaryButton.click();
    });
  }
}
```

## Spec file template

```typescript
/**
 * [App Name] - [Feature Name] Tests
 *
 * [Brief description of what is tested]
 */
import { test, expect } from '../../fixtures';
// ⚠️ Import locale helpers — REQUIRED for any text assertion
import { t, tLoc } from '../../helpers/locale';

test.describe('[App] - [Feature]', () => {
  test('[description] @smoke', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — use tLoc() for locator, t() for text assertions
    await expect(imageManager.frame.locator(tLoc('[i18n.button.key]'))).toBeVisible();
    console.log('✅ [pass condition]');
  });

  test('[second test case]', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — use Page Object methods (which already use tLoc internally)
    await imageManager.clickOptimizeNow();

    // ✅ CORRECT — t() resolves to current locale text
    await expect(imageManager.toast).toBeVisible({ timeout: 10000 });
    console.log('✅ Toast appeared after action');
  });

  test('[stats/labels assertion]', async ({ imageManager }) => {
    await imageManager.waitForLoad();

    // ✅ CORRECT — use t() for label text
    await expect(
      imageManager.frame.getByText(t('[i18n.label.key]'), { exact: false })
    ).toBeVisible({ timeout: 10000 });
  });
});
```

## Quick reference — i18n usage

| Cần làm | Dùng hàm | Ví dụ |
|---|---|---|
| Locator theo text | `tLoc(key)` | `frame.locator(tLoc('ButtonOptimize.labelOtm'))` |
| Locator getByRole | `tRegex(key)` | `frame.getByRole('button', { name: tRegex('ButtonOptimize.labelOtm') })` |
| Assert text content | `t(key)` | `expect(el).toContainText(t('Optimizer.SuccessBanner.Title'))` |
| getByText assertion | `t(key)` | `frame.getByText(t('Report.Tooltip.TotalImage'))` |

**⚠️ NEVER use bare string literals for UI text:**
```typescript
// ❌ WRONG — hardcoded, breaks on non-English stores
frame.getByText('Optimize now')
frame.getByText('Total images')
expect(toast).toContainText('Optimize successfully')

// ✅ CORRECT
frame.locator(tLoc('ButtonOptimize.labelOtm'))
frame.getByText(t('Report.Tooltip.TotalImage'))
expect(toast).toContainText(t('Optimizer.SuccessBanner.Title'))
```
