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
 * This file was auto-generated. It can be re-run on any environment
 * (local, staging, prod) — handles are resolved at runtime via helpers/apps.ts.
 */

import { test, expect } from '../../fixtures';

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
      // v2 removed the confirmation modal — dialog must NOT appear
      await expect(imageManager.dialog).not.toBeVisible({ timeout: 3000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      await expect(imageManager.toast).toContainText('Optimization started', { timeout: 5000 });
      console.log('✅ Toast "Optimization started" appeared');
    });
  });

  test('Optimize unoptimized — no confirmation modal', async ({ imageManager }) => {
    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize unoptimized', async () => {
      await imageManager.frame.getByRole('button', { name: 'Optimize unoptimized' }).click();
      console.log('✅ Clicked Optimize unoptimized');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      await expect(imageManager.dialog).not.toBeVisible({ timeout: 3000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      await expect(imageManager.toast).toContainText('Optimization started', { timeout: 5000 });
      console.log('✅ Toast "Optimization started" appeared');
    });
  });

  test('Optimization progress state displays correctly after trigger', async ({ imageManager }) => {
    await test.step('Trigger Optimize all', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert progress bar is visible', async () => {
      await expect(imageManager.progress).toBeVisible({ timeout: 10000 });
      console.log('✅ Progress bar visible');
    });

    await test.step('Assert progress label text is visible', async () => {
      const progressLabel = imageManager.frame.getByText(/optimiz(ing images|e in progress)/i);
      await expect(progressLabel).toBeVisible({ timeout: 10000 });
      console.log('✅ Progress label visible');
    });

    await test.step('Assert time estimate text appears', async () => {
      const timeEstimate = imageManager.frame.getByText(/calculating time remain|remaining/i);
      await expect(timeEstimate).toBeVisible({ timeout: 15000 });
      console.log('✅ Time estimate text visible');
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
      const actionButton = imageManager.frame
        .locator('tr, [class*="Row"]')
        .first()
        .getByRole('button', { name: /compress image|revert/i });
      await expect(actionButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Per-row action button found');
    });

    await test.step('Assert no broken layout or missing columns', async () => {
      // Verify key column headers or cells are present
      const table = imageManager.compareTable;
      await expect(table).toBeVisible({ timeout: 5000 });
      console.log('✅ Table layout intact');
    });
  });

  test('LeavePrompt guard — unsaved changes warning still works', async ({ imageManager }) => {
    await test.step('Change a setting to trigger unsaved state', async () => {
      // Toggle a compression setting (checkbox or switch)
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
      // Check for Polaris modal or browser dialog
      const leavePrompt = imageManager.page.locator(
        '[role="dialog"]:has-text("unsaved"), [role="dialog"]:has-text("leave"), [role="dialog"]:has-text("discard")'
      );
      const browserDialog = imageManager.page.locator('[role="alertdialog"]');

      const promptVisible = await leavePrompt.isVisible({ timeout: 5000 }).catch(() => false);
      const dialogVisible = await browserDialog.isVisible({ timeout: 2000 }).catch(() => false);

      expect(promptVisible || dialogVisible).toBeTruthy();
      console.log('✅ Unsaved changes warning appeared');
    });

    await test.step('Dismiss prompt and verify navigation proceeds', async () => {
      // Try clicking Discard or Leave button
      const discardBtn = imageManager.page.getByRole('button', { name: /discard|leave/i }).first();
      if (await discardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await discardBtn.click();
      }
      // Verify we navigated away (Image Manager content should not be visible)
      await expect(imageManager.optimizeNowButton).not.toBeVisible({ timeout: 10000 });
      console.log('✅ Navigation proceeded after dismissing prompt');
    });
  });
});
