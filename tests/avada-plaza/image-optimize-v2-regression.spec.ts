/**
 * Image Optimize v2 — Regression Suite
 *
 * Core v2 change: ButtonOptimize no longer accepts shouldConfirm/openModal/closeModal
 * — modal flow is removed entirely. Toast assertions use [role="alert"] (not hardcoded classes).
 * ImageViewCompareTable lost 11 lines; verify no visual regression.
 * LeavePrompt received logic changes (+7/-2) so guard test is warranted.
 *
 * Run:  npx playwright test tests/avada-plaza/image-optimize-v2-regression.spec.ts --headed
 */
import { test, expect } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// TC01 — Optimize all — no confirmation modal (v2 regression) @smoke
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize all — no confirmation modal (v2 regression) @smoke',
  async ({ imageManager }) => {
    await test.step('Wait for page to load (no skeleton visible)', async () => {
      await imageManager.waitForSkeletonGone();
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Page loaded — skeleton gone, Optimize now visible');
    });

    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize all from dropdown', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal/dialog appears', async () => {
      // v2: shouldConfirm/openModal/closeModal removed — no modal expected
      await expect(imageManager.dialog).toBeHidden({ timeout: 3000 });
      console.log('✅ No confirmation modal — v2 modal gate removed');
    });

    await test.step('Assert optimization starts immediately (toast or progress)', async () => {
      await expect(
        imageManager.toast.or(imageManager.progress).or(imageManager.banner)
      ).toBeVisible({ timeout: 5000 });
      console.log('✅ Optimization started immediately without modal');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC02 — Optimize action triggers toast notification
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize action triggers toast notification',
  async ({ imageManager }) => {
    await test.step('Wait for page to fully load', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Page loaded');
    });

    await test.step('Trigger optimize all action', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Optimize all triggered');
    });

    await test.step('Assert toast/alert notification is visible within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast notification appeared');
    });

    await test.step('Assert toast message text is correct', async () => {
      const toastText = await imageManager.toast.textContent();
      expect(toastText?.trim()).toBeTruthy();
      // Feature context: "Optimization started" or "Optimize successfully"
      expect(toastText!.toLowerCase()).toContain('optim');
      console.log(`✅ Toast text: "${toastText?.trim()}"`);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC03 — Image Manager page smoke — key elements present
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Image Manager page smoke — key elements present',
  async ({ imageManager }) => {
    await test.step('Assert page loads without error (no skeleton lingering)', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Skeleton gone — page loaded');
    });

    await test.step('Assert Optimize now button is visible and enabled', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Optimize now button visible');
    });

    await test.step('Assert image table/list is rendered', async () => {
      // Check stat labels that indicate images are loaded
      await expect(imageManager.frame.getByText('Total images')).toBeVisible({ timeout: 10000 });
      console.log('✅ Image stats section rendered');
    });

    await test.step('Assert filter controls are visible', async () => {
      // IndexFilters or filter bar should be present on the compression page
      const filterArea = imageManager.filterBar
        .or(imageManager.frame.locator('[class*="IndexFilters"]').first());
      await expect(filterArea.first()).toBeVisible({ timeout: 10000 });
      console.log('✅ Filter controls visible');
    });

    await test.step('Assert stat labels are all present', async () => {
      const expectedLabels = ['Total images', 'Original size', 'Optimized size', 'Size saved'];
      for (const label of expectedLabels) {
        await expect(imageManager.frame.getByText(label)).toBeVisible({ timeout: 5000 });
      }
      console.log('✅ All stat labels present: Total images, Original size, Optimized size, Size saved');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC04 — ImageViewCompareTable renders after reduction (-11 lines)
// ─────────────────────────────────────────────────────────────────────────────
test(
  'ImageViewCompareTable renders after reduction (-11 lines)',
  async ({ imageManager }) => {
    await test.step('Wait for Image Manager to load', async () => {
      await imageManager.waitForSkeletonGone();
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Image Manager loaded');
    });

    await test.step('Assert table with image data renders', async () => {
      // The compression table shows image rows with size before/after
      const tableOrCards = imageManager.frame.locator(
        'table, [class*="IndexTable"], [class*="Card"]'
      );
      await expect(tableOrCards.first()).toBeVisible({ timeout: 10000 });
      console.log('✅ Table/card structure rendered');
    });

    await test.step('Assert image sizes or compression ratio data is displayed', async () => {
      // Stat labels from the Report component show compression data
      const sizeLabels = ['Original size', 'Optimized size', 'Size saved'];
      for (const label of sizeLabels) {
        const el = imageManager.frame.getByText(label);
        await expect(el).toBeVisible({ timeout: 5000 });
        // Verify the value next to the label is not empty
        const parentText = await el.locator('..').textContent();
        expect(parentText?.trim().length).toBeGreaterThan(label.length);
      }
      console.log('✅ Compression ratio data displayed — no missing values');
    });

    await test.step('Assert no broken layout (cards render properly)', async () => {
      const cards = imageManager.frame.locator('[class*="Card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`✅ ${count} card section(s) rendered — no collapsed layout`);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC05 — Leave page during optimization — leave prompt guard
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Leave page during optimization — leave prompt guard',
  async ({ imageManager }) => {
    await test.step('Trigger optimization', async () => {
      await imageManager.triggerOptimizeAll();
      await expect(
        imageManager.toast.or(imageManager.progress).or(imageManager.banner)
      ).toBeVisible({ timeout: 15000 });
      console.log('✅ Optimization in progress');
    });

    await test.step('Immediately attempt to navigate away', async () => {
      await imageManager.navigateAway();
      console.log('✅ Navigation away attempted');
    });

    await test.step('Assert leave prompt appears OR navigation is blocked', async () => {
      // LeavePrompt may appear in iframe or in the parent page
      const leaveDialog = imageManager.dialog
        .or(imageManager.page.locator('[role="dialog"]'));

      const dialogVisible = await leaveDialog.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (dialogVisible) {
        console.log('✅ Leave prompt dialog appeared');

        await test.step('Confirm leave and assert navigation proceeds', async () => {
          const leaveBtn = imageManager.frame.getByRole('button', { name: /leave/i })
            .or(imageManager.page.getByRole('button', { name: /leave/i }));
          await leaveBtn.first().click();
          await expect(imageManager.optimizeNowButton).toBeHidden({ timeout: 10000 });
          console.log('✅ Confirmed leave — navigated away from Image Manager');
        });
      } else {
        // Navigation was blocked (page stayed on Image Manager)
        await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 5000 });
        console.log('✅ Navigation blocked — still on Image Manager with optimization running');
      }
    });
  }
);
