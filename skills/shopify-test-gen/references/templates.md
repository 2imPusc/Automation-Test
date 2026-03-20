# Templates

## Page Object template

```typescript
import { Page, FrameLocator, Locator } from '@playwright/test';
import { test } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for [Page Name] of [App Name].
 */
export class [PageName]Page extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  get primaryButton(): Locator {
    return this.frame.getByRole('button', { name: 'Button Name' });
  }

  get successToast(): Locator {
    return this.frame.locator('[role="alert"], [class*="toast" i]').first();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goTo(): Promise<void> {
    await test.step('[PageName]: navigate', async () => {
      await this.page.getByRole('link', { name: 'Nav Label' }).click();
      await this.waitForLoad();
    });
  }

  async waitForLoad(): Promise<void> {
    await this.frame.getByText('Unique Heading').waitFor({ state: 'visible', timeout: 20000 });
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
import { test, expect } from '@playwright/test';
// If using imageManager fixture instead:
// import { test, expect } from '../../fixtures';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';
import { [PageName]Page } from '../../helpers/pages/[PageName]Page';

test.describe('[App] - [Feature]', () => {
  test('[description] @smoke', async ({ page }) => {
    const frame = await goToApp(page, APPS.[appKey].handle);
    const featurePage = new [PageName]Page(page, frame);
    await featurePage.goTo();

    await expect(featurePage.primaryButton).toBeVisible();
    console.log('✅ [pass condition]');
  });

  test('[second test case]', async ({ page }) => {
    const frame = await goToApp(page, APPS.[appKey].handle);
    const featurePage = new [PageName]Page(page, frame);
    await featurePage.goTo();

    await featurePage.clickPrimary();
    await expect(featurePage.successToast).toBeVisible({ timeout: 10000 });
    console.log('✅ Toast appeared after action');
  });
});
```
