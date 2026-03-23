/**
 * Image Optimize v2 — Full Regression Suite
 *
 * Covers all v2 changes:
 *  - Smoke: Image Manager loads with Optimize button visible
 *  - Regression: no confirmation modal on Optimize all & single image
 *  - Regression: toast notification fires after optimization
 *  - Regression: image compare table renders correctly
 *  - Guard: leave prompt during active optimization
 *
 * Run:  npx playwright test tests/avada-plaza/image-optimize-v2-full.spec.ts --headed
 */
import { test, expect } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// TC01 — Image Manager loads with Optimize button visible
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Image Manager loads with Optimize button visible @smoke',
  async ({ imageManager }) => {
    await test.step('Wait for skeleton loader to disappear', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Skeleton loader gone');
    });

    await test.step('Assert image table/content area is visible', async () => {
      const contentArea = imageManager.frame.locator('table, [class*="Card"]').first();
      await expect(contentArea).toBeVisible({ timeout: 15000 });
      console.log('✅ Image table/content area is visible');
    });

    await test.step('Assert Optimize now button is present and enabled', async () => {
      const optimizeBtn = imageManager.frame.getByText('Optimize now');
      await expect(optimizeBtn).toBeVisible();
      await expect(optimizeBtn).toBeEnabled();
      console.log('✅ Optimize now button is visible and enabled');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC02 — Optimize all: no confirmation modal appears (v2 regression)
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize all — no confirmation modal appears (v2 regression) @regression',
  async ({ imageManager }) => {
    await test.step('Wait for image table to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image table loaded');
    });

    await test.step('Click Optimize now button', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Optimize now clicked');
    });

    await test.step('Click Optimize all (dropdown option)', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Optimize all clicked');
    });

    await test.step('Assert no dialog/modal appears', async () => {
      await expect(imageManager.dialog).toBeHidden({ timeout: 3000 });
      console.log('✅ No confirmation modal — v2 regression verified');
    });

    await test.step('Assert optimization starts immediately', async () => {
      await expect(imageManager.toast.or(imageManager.progress))
        .toBeVisible({ timeout: 15000 });
      console.log('✅ Optimization started without confirmation step');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC03 — Toast notification appears after triggering optimization
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Toast notification appears after triggering optimization @regression',
  async ({ imageManager }) => {
    await test.step('Wait for image table to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image table loaded');
    });

    await test.step('Trigger Optimize all', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Optimize all triggered');
    });

    await test.step('Assert toast/alert notification is visible within 5s', async () => {
      const alert = imageManager.frame.locator('[role="alert"]').first();
      await expect(alert).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast notification appeared');
    });

    await test.step('Assert toast contains relevant optimization message', async () => {
      const alert = imageManager.frame.locator('[role="alert"]').first();
      const text = await alert.textContent();
      expect(text?.trim()).toBeTruthy();
      expect(text!.toLowerCase()).not.toContain('error');
      console.log(`✅ Toast text: "${text?.trim()}"`);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC04 — Image compare table renders correctly after v2 changes
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Image compare table renders correctly after v2 changes @regression',
  async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image list loaded');
    });

    await test.step('Assert compare table/content section is visible', async () => {
      const tableOrCard = imageManager.frame.locator('table, [class*="Card"]').first();
      await expect(tableOrCard).toBeVisible({ timeout: 15000 });
      console.log('✅ Compare table/content section is visible');
    });

    await test.step('Assert all expected stat columns are present', async () => {
      await expect(imageManager.frame.getByText('Total images')).toBeVisible();
      await expect(imageManager.frame.getByText('Original size')).toBeVisible();
      await expect(imageManager.frame.getByText('Optimized size')).toBeVisible();
      await expect(imageManager.frame.getByText('Size saved')).toBeVisible();
      console.log('✅ All stat labels rendered — no missing columns');
    });

    await test.step('Assert no broken layout or empty regions', async () => {
      const cards = imageManager.frame.locator('[class*="Card"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible();
      console.log(`✅ ${cardCount} card section(s) rendered — layout intact`);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC05 — Leave prompt fires when navigating away mid-optimization
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Leave prompt fires when navigating away mid-optimization @guard',
  async ({ imageManager }) => {
    await test.step('Trigger an optimization action', async () => {
      await imageManager.triggerOptimizeAll();
      await expect(imageManager.toast.or(imageManager.progress))
        .toBeVisible({ timeout: 15000 });
      console.log('✅ Optimization started');
    });

    await test.step('Attempt to navigate to another page', async () => {
      await imageManager.navigateAway();
      console.log('✅ Navigation away attempted');
    });

    await test.step('Assert leave/unsaved-changes prompt appears', async () => {
      const leaveDialog = imageManager.frame.locator('[role="dialog"]')
        .or(imageManager.page.locator('[role="dialog"]'));
      await expect(leaveDialog.first()).toBeVisible({ timeout: 5000 });
      console.log('✅ Leave prompt dialog is visible');
    });

    await test.step('Click Stay — verify user remains on Image Manager', async () => {
      const stayButton = imageManager.frame.getByRole('button', { name: /stay/i })
        .or(imageManager.page.getByRole('button', { name: /stay/i }));
      await stayButton.first().click();
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 10000 });
      console.log('✅ Clicked Stay — still on Image Manager');
    });

    await test.step('Navigate away again and click Leave', async () => {
      await imageManager.navigateAway();
      const leaveButton = imageManager.frame.getByRole('button', { name: /leave/i })
        .or(imageManager.page.getByRole('button', { name: /leave/i }));
      await leaveButton.first().click();
      await expect(imageManager.frame.getByText('Optimize now')).toBeHidden({ timeout: 10000 });
      console.log('✅ Clicked Leave — navigated away without errors');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC06 — Optimize single image: no modal, immediate action
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize single image — no modal, immediate action @regression',
  async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Image list loaded');
    });

    await test.step('Switch to manual mode to find unoptimized image', async () => {
      await imageManager.switchToManualMode();
      await imageManager.waitForSkeletonGone();
      console.log('✅ Manual mode active');
    });

    await test.step('Click per-row Optimize button', async () => {
      await imageManager.clickPerRowOptimize();
      console.log('✅ Per-row optimize clicked');
    });

    await test.step('Assert no dialog/modal appears', async () => {
      await expect(imageManager.dialog).toBeHidden({ timeout: 3000 });
      console.log('✅ No modal — direct action confirmed (v2)');
    });

    await test.step('Assert row status updates or toast is shown', async () => {
      await expect(imageManager.toast.or(imageManager.progress))
        .toBeVisible({ timeout: 10000 });
      console.log('✅ Row status updating — toast/progress visible');
    });
  }
);
