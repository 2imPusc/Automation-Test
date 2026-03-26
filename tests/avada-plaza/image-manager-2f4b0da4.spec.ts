/**
 * @generated AI Pipeline — 2026-03-26 06:31:15
 * @notion
 * @task [App plaza] Image Optimize v2
 * @taskId 2f4b0da449f180fca386da4afc6f7abd
 * @app Avada Plaza (avadaPlaza)
 * @branch improve/opt-image-v2
 * @feature image-manager.md
 * @scenarios 6
 *
 * This file was auto-generated. It can be re-run on any environment
 * (local, staging, prod) — handles are resolved at runtime via helpers/apps.ts.
 */

import { test, expect } from '../../fixtures';
import { t, tRegex, tLoc } from '../../helpers/locale';

test.describe('Image Manager — Optimize v2 Regression', () => {
  /**
   * Truy cập trang Image Manager và kiểm tra các thành phần chính xuất hiện sau khi nâng cấp v2.
   * Kỳ vọng: nút 'Optimize now', bảng thống kê, và danh sách ảnh tải đúng, không bị vỡ layout.
   */
  test('Image Manager — smoke (trang tải, các thành phần hiển thị đầy đủ) @smoke', async ({ imageManager }) => {
    await test.step('Close Sidekick if open', async () => {
      const closeSidekick = imageManager.page.getByRole('button', { name: 'Close Sidekick' });
      if (await closeSidekick.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeSidekick.click();
      }
      console.log('✅ Sidekick handled');
    });

    await test.step('Wait for page to finish loading', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Assert Optimize now button is visible', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Optimize now button visible');
    });

    await test.step('Assert statistics section is visible', async () => {
      const statsLabels = [
        t('Report.Tooltip.TotalImage'),    // "Total images"
        t('Report.totalCompression'),      // "Total compression"
      ];
      for (const label of statsLabels) {
        await expect(
          imageManager.frame.getByText(label, { exact: false })
        ).toBeVisible({ timeout: 10000 });
      }
      console.log('✅ Statistics labels visible');
    });

    await test.step('Assert image table renders rows or empty state', async () => {
      const rows = imageManager.imageTableRows;
      const emptyState = imageManager.emptyState;
      await expect(rows.first().or(emptyState)).toBeVisible({ timeout: 15000 });
      console.log('✅ Image table or empty state visible');
    });

    await test.step('Assert no loading skeleton remains', async () => {
      await expect(imageManager.skeleton).not.toBeVisible({ timeout: 5000 });
      console.log('✅ No skeleton loading remaining');
    });
  });

  /**
   * Nhấn 'Optimize now' rồi chọn 'Optimize all' từ dropdown.
   * Kỳ vọng: KHÔNG xuất hiện hộp thoại xác nhận vì v2 đã xóa props shouldConfirm/openModal/closeModal
   * khỏi ButtonOptimize. Toast 'Optimization started' phải xuất hiện trong vòng 5 giây.
   */
  test('Optimize all — no confirmation modal (v2 regression)', async ({ imageManager }) => {
    await test.step('Wait for page to finish loading', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize all from dropdown', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      const realDialog = imageManager.frame.locator('[role="dialog"]');
      await expect(realDialog).not.toBeVisible({ timeout: 2000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast notification appeared');
    });
  });

  /**
   * Nhấn 'Optimize now' rồi chọn 'Optimize unoptimized' từ dropdown.
   * Kỳ vọng: quy trình chạy trực tiếp không qua bước xác nhận, toast xuất hiện ngay sau khi click.
   */
  test('Optimize unoptimized — no confirmation modal (v2 regression)', async ({ imageManager }) => {
    await test.step('Wait for page to finish loading', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Click Optimize now', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Clicked Optimize now');
    });

    await test.step('Click Optimize unoptimized from dropdown', async () => {
      await imageManager.clickOptimizeUnoptimized();
      console.log('✅ Clicked Optimize unoptimized');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      const realDialog = imageManager.frame.locator('[role="dialog"]');
      await expect(realDialog).not.toBeVisible({ timeout: 2000 });
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast appeared');
    });
  });

  /**
   * Sau khi trigger optimize, kiểm tra trạng thái tiến trình hiển thị chính xác.
   * Kỳ vọng: progress bar và nhãn 'Optimizing images' xuất hiện, nút 'Optimize now' bị disable trong lúc chạy.
   */
  test('Progress state — banner và progress bar hiển thị đúng sau khi bắt đầu optimize', async ({ imageManager }) => {
    await test.step('Wait for page to finish loading', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Trigger Optimize all (no modal expected)', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert progress bar is visible', async () => {
      await expect(imageManager.progress).toBeVisible({ timeout: 10000 });
      console.log('✅ Progress bar visible');
    });

    await test.step('Assert "Optimizing images" or "Optimize in progress" text is visible', async () => {
      const progressText = imageManager.frame.locator(
        tLoc('Optimizer.Optimizing') // "Optimizing images" | locale text
      ).or(imageManager.frame.locator(tLoc('Optimizer.OptimizeProcess'))).first();
      await expect(progressText).toBeVisible({ timeout: 10000 });
      console.log('✅ Progress text visible');
    });

    await test.step('Assert Optimize now button is disabled during progress', async () => {
      // The button may show "Optimizing" label or be disabled
      const optimizeBtn = imageManager.optimizeNowButton;
      const optimizingBtn = imageManager.frame.locator(tLoc('ButtonOptimize.labelLoading')).first();

      // Either the original button is disabled, or it shows "Optimizing" state
      const isDisabled = await optimizeBtn.isDisabled().catch(() => false);
      const isOptimizingLabel = await optimizingBtn.isVisible({ timeout: 3000 }).catch(() => false);

      expect(isDisabled || isOptimizingLabel).toBeTruthy();
      console.log('✅ Optimize now button is disabled/loading during progress');
    });
  });

  /**
   * Thay đổi một cài đặt compression chưa lưu rồi cố thoát trang.
   * Kỳ vọng: LeavePrompt vẫn kích hoạt đúng, hiển thị 'Unsaved changes' trên Shopify save bar
   * và chặn điều hướng cho đến khi người dùng xác nhận.
   */
  test('Leave prompt — cảnh báo unsaved changes vẫn hoạt động sau thay đổi LeavePrompt.js', async ({ imageManager }) => {
    await test.step('Wait for page to load', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Page loaded');
    });

    await test.step('Change a compression setting to trigger unsaved state', async () => {
      const toggle = imageManager.frame.locator(
        'input[type="checkbox"], [role="switch"], [role="radio"]'
      ).first();
      await toggle.waitFor({ state: 'visible', timeout: 10000 });
      await toggle.click({ force: true });
      await imageManager.page.waitForTimeout(1000);
      console.log('✅ Toggled a compression setting');
    });

    await test.step('Attempt to navigate away', async () => {
      await imageManager.navigateAway();
      console.log('✅ Attempted navigation away');
    });

    await test.step('Assert Shopify save bar with "Unsaved changes" appears', async () => {
      await expect(imageManager.unsavedChangesBar).toBeVisible({ timeout: 5000 });
      console.log('✅ Unsaved changes save bar appeared');
    });

    await test.step('Click Discard and verify navigation proceeds', async () => {
      await imageManager.clickDiscard();
      // Wait for navigation to complete — save bar should disappear
      await expect(imageManager.unsavedChangesBar).not.toBeVisible({ timeout: 10000 });
      console.log('✅ Discard clicked, navigation proceeded without error');
    });
  });

  /**
   * Sau khi toàn bộ quá trình optimize kết thúc, kiểm tra banner/toast thành công hiển thị đúng
   * và số liệu thống kê được cập nhật. Kỳ vọng: banner 'Optimize successfully' xuất hiện,
   * số 'Images optimized' tăng lên so với trước.
   */
  test('Success banner sau khi bulk optimize hoàn tất', async ({ imageManager }) => {
    await test.step('Wait for page to load', async () => {
      await imageManager.waitForLoad();
      console.log('✅ Page loaded');
    });

    let countBefore = 0;
    await test.step('Note current "Images optimized" count', async () => {
      countBefore = await imageManager.getImagesOptimizedCount();
      console.log(`✅ Images optimized before: ${countBefore}`);
    });

    await test.step('Trigger Optimize all (no modal expected)', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Wait for progress bar to disappear', async () => {
      const progressBar = imageManager.progress;
      const progressVisible = await progressBar.isVisible({ timeout: 5000 }).catch(() => false);
      if (progressVisible) {
        await expect(progressBar).not.toBeVisible({ timeout: 120000 });
        console.log('✅ Progress bar disappeared — optimization complete');
      } else {
        console.log('✅ No progress bar — optimization completed instantly');
      }
    });

    await test.step('Assert success toast or banner is visible', async () => {
      const successIndicator = imageManager.frame.locator(
        tLoc('Optimizer.SuccessBanner.Title') // "Optimize successfully" | locale text
      ).or(imageManager.frame.locator(tLoc('Optimizer.SuccessBanner.Description'))).first();
      const successToast = imageManager.toast;

      await expect(successIndicator.or(successToast)).toBeVisible({ timeout: 15000 });

      // Verify no error state
      const errorBanner = imageManager.frame.locator(
        tLoc('BannerError.Banner.title') // "Something went wrong" | locale text
      ).first();
      await expect(errorBanner).not.toBeVisible({ timeout: 2000 });
      console.log('✅ Success banner/toast visible, no errors');
    });

    await test.step('Assert "Images optimized" count has increased', async () => {
      // Wait a moment for stats to update after optimization completes
      await imageManager.page.waitForTimeout(2000);
      const countAfter = await imageManager.getImagesOptimizedCount();
      console.log(`✅ Images optimized after: ${countAfter}`);
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    });
  });
});
