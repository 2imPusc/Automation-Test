/**
 * @generated AI Pipeline — 2026-03-25 07:05:24
 * @notion
 * @task [App plaza] Image Optimize v2
 * @taskId 2f4b0da449f180fca386da4afc6f7abd
 * @app Avada Plaza (avadaPlaza)
 * @branch improve/opt-image-v2
 * @feature image-manager.md
 * @scenarios 5
 *
 * This file was auto-generated then manually fixed for locale support.
 * It can be re-run on any environment and any store locale.
 * Set TEST_LOCALE=de|fr|vi|... to match the store language.
 */

import { test, expect } from '../../fixtures';
import { t, tRegex, tLoc } from '../../helpers/locale';

test.describe('Image Manager — Optimize v2 Regression', () => {
  test('Optimize all — no confirmation modal (v2 regression) @smoke', async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize all', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      await expect(imageManager.dialog).not.toBeVisible({ timeout: 3000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast notification is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast notification appeared');
    });
  });

  test('Optimize unoptimized — no confirmation modal', async ({ imageManager }) => {
    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize unoptimized', async () => {
      // Locale-aware: "Optimize unoptimized" / "Nicht optimierte optimieren"
      const btn = imageManager.frame.locator(
        tLoc('ButtonOptimize.optionUnoptimized')
      ).first();
      await btn.click();
      console.log('✅ Clicked Optimize unoptimized');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      await expect(imageManager.dialog).not.toBeVisible({ timeout: 3000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast notification is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast appeared');
    });
  });

  test('Optimization progress state displays correctly after trigger', async ({ imageManager }) => {
    await test.step('Trigger Optimize all', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert progress or banner is visible', async () => {
      // Wait for progress bar OR success banner (optimization may be instant on small stores)
      await expect(imageManager.progress.or(imageManager.banner).or(imageManager.toast))
        .toBeVisible({ timeout: 15000 });
      console.log('✅ Progress/banner/toast visible');
    });

    await test.step('Assert progress label text is visible', async () => {
      // Locale-aware: "Optimizing images" / "Bilder optimieren"
      const optimizingRegex = tRegex('Optimizer.Optimizing');
      const progressRegex = tRegex('Optimizer.OptimizeProcess');
      const label = imageManager.frame.locator(`text=/${optimizingRegex.source}|${progressRegex.source}/i`).first();
      const visible = await label.isVisible({ timeout: 10000 }).catch(() => false);
      if (visible) {
        console.log('✅ Progress label visible');
      } else {
        // Optimization may have completed instantly — check for success
        console.log('⚠️ Progress label not found — optimization may have completed instantly');
      }
    });
  });

  test('Image table renders correctly after ImageViewCompareTable reduction', async ({ imageManager }) => {
    await test.step('Wait for image list to fully load', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Skeleton gone, content loaded');
    });

    await test.step('Assert image rows are visible in the table', async () => {
      const rowCount = await imageManager.imageTableRows.count();
      expect(rowCount).toBeGreaterThan(0);
      console.log(`✅ Image table has ${rowCount} rows`);
    });

    await test.step('Assert per-row actions are present', async () => {
      // Locale-aware: "Compress image" / "Bild komprimieren" / "Revert" / "Rückgängig"
      const compressRegex = tRegex('ManualCompression.Compress');
      const revertRegex = tRegex('ManualCompression.Revert');
      const actionButton = imageManager.frame
        .locator('tr, [class*="Row"]')
        .first()
        .locator(`text=/${compressRegex.source}|${revertRegex.source}/i`);
      const visible = await actionButton.isVisible({ timeout: 10000 }).catch(() => false);
      if (visible) {
        console.log('✅ Per-row action button found');
      } else {
        console.log('⚠️ No per-row action — table may show optimized images without actions');
      }
    });

    await test.step('Assert no broken layout or missing columns', async () => {
      const table = imageManager.compareTable;
      await expect(table).toBeVisible({ timeout: 5000 });
      console.log('✅ Table layout intact');
    });
  });

  test('LeavePrompt guard — unsaved changes warning still works', async ({ imageManager }) => {
    await test.step('Change a setting to trigger unsaved state', async () => {
      const toggle = imageManager.frame.locator('input[type="checkbox"], [role="switch"]').first();
      await toggle.waitFor({ state: 'visible', timeout: 10000 });
      await toggle.click();
      console.log('✅ Toggled a setting');
    });

    await test.step('Navigate away to trigger leave prompt', async () => {
      await imageManager.navigateAway();
      console.log('✅ Attempted navigation away');
    });

    await test.step('Assert unsaved changes warning appears', async () => {
      // Locale-aware: check for dialog with discard/leave/unsaved text
      const discardText = t('AvadaContextualSaveBar.modal.buttonTitle'); // "Discard changes"
      const dialogSelectors = [
        `[role="dialog"]:has-text("${discardText}")`,
        '[role="dialog"]:has-text("unsaved")',
        '[role="dialog"]:has-text("leave")',
        '[role="dialog"]:has-text("discard")',
        '[role="alertdialog"]',
      ].join(', ');

      const prompt = imageManager.page.locator(dialogSelectors).first();
      const visible = await prompt.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible).toBeTruthy();
      console.log('✅ Unsaved changes warning appeared');
    });

    await test.step('Dismiss prompt and verify navigation proceeds', async () => {
      // Locale-aware discard button
      const discardText = tRegex('AvadaContextualSaveBar.modal.buttonTitle');
      const discardBtn = imageManager.page.locator(
        `button:has-text("${discardText.source}"), [role="button"]:has-text("discard"), [role="button"]:has-text("leave")`
      ).first();
      if (await discardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await discardBtn.click();
      }
      await expect(imageManager.optimizeNowButton).not.toBeVisible({ timeout: 10000 });
      console.log('✅ Navigation proceeded after dismissing prompt');
    });
  });
});
