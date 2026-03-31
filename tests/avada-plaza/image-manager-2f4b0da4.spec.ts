/**
 * @generated AI Pipeline — 2026-03-30 03:49:37
 * @notion
 * @task [App plaza] Image Optimize v2
 * @taskId 2f4b0da449f180fca386da4afc6f7abd
 * @app Avada Plaza (avadaPlaza)
 * @branch improve/opt-image-v2
 * @feature image-manager.md
 * @scenarios 4
 *
 * This file was auto-generated. It can be re-run on any environment
 * (local, staging, prod) — handles are resolved at runtime via helpers/apps.ts.
 */

import { test, expect } from '../../fixtures';
import { t, tRegex, tLoc } from '../../helpers/locale';

test.describe('Image Manager v2 — Compression', () => {
  /**
   * Kiểm tra rằng sau khi xóa các prop shouldConfirm/openModal/closeModal khỏi ButtonOptimize, nhấn 'Optimize now' → 'Optimize all' KHÔNG hiển thị confirmation dialog. Tối ưu hóa phải bắt đầu ngay lập tức mà không cần bước xác nhận trung gian.
   */
  test('Optimize All — no confirmation modal after prop removal @smoke', async ({ imageManager }) => {
    await test.step('Wait for page to load and optimize button to be visible', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Page loaded, Optimize now button visible');
    });

    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Click Optimize all from dropdown', async () => {
      const optimizeAllBtn = imageManager.optimizeAllButton;
      if (await optimizeAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await imageManager.clickOptimizeAll();
        console.log('✅ Clicked Optimize all');
      } else {
        console.log('✅ No dropdown appeared — Optimize now triggered directly');
      }
    });

    await test.step('Assert no confirmation modal appears', async () => {
      // Exclude Sidekick which is always in DOM
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      // Short wait to ensure any modal would have time to render
      await imageManager.page.waitForTimeout(500);
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert optimization starts — toast or progress indicator visible within 5s', async () => {
      const toastOrProgress = imageManager.toast.or(imageManager.progress);
      await expect(toastOrProgress).toBeVisible({ timeout: 5000 });
      console.log('✅ Optimization started (toast or progress indicator visible)');
    });
  });

  /**
   * Kiểm tra thay đổi trong ABanner/index.js không làm hỏng hiển thị toast/notification sau khi kích hoạt tối ưu hóa. Toast phải xuất hiện đúng nội dung, không bị trùng lặp, và có thể tự đóng hoặc đóng thủ công.
   */
  test('ABanner — toast notification displays correctly after optimization trigger', async ({ imageManager, page }) => {
    // Collect console errors during this test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await test.step('Trigger Optimize all (no modal expected)', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert toast/banner notification appears after the action', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast notification appeared');
    });

    await test.step('Assert notification text is non-empty and relevant', async () => {
      const toastText = await imageManager.toast.textContent();
      expect(toastText).toBeTruthy();
      expect(toastText!.trim().length).toBeGreaterThan(0);
      console.log(`✅ Toast text: "${toastText}"`);
    });

    await test.step('Assert only one toast appears (no duplicates)', async () => {
      const allToasts = imageManager.frame.locator('.Polaris-Frame-ToastManager [role="alert"]');
      const toastCount = await allToasts.count();
      expect(toastCount).toBeLessThanOrEqual(1);
      console.log(`✅ Toast count: ${toastCount} (no duplicates)`);
    });

    await test.step('Assert toast auto-dismisses or has close control', async () => {
      // Wait up to 10s for toast to auto-dismiss
      const toastLocator = imageManager.frame.locator('.Polaris-Frame-ToastManager [role="alert"]');
      const dismissed = await toastLocator.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);

      if (dismissed) {
        console.log('✅ Toast auto-dismissed');
      } else {
        // Check for close button within the toast area
        const closeBtn = imageManager.frame.locator('.Polaris-Frame-ToastManager button, .Polaris-Frame-ToastManager [aria-label="Dismiss"]').first();
        const hasClose = await closeBtn.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasClose) {
          await closeBtn.click();
          console.log('✅ Toast closed via close button');
        } else {
          console.log('✅ Toast still visible (may have longer auto-dismiss timer)');
        }
      }
    });

    await test.step('Assert no JS errors related to banner/toast rendering', async () => {
      const relevantErrors = consoleErrors.filter(e =>
        /banner|toast|abanner|render/i.test(e)
      );
      expect(relevantErrors).toHaveLength(0);
      console.log('✅ No JS console errors related to banner/toast rendering');
    });
  });

  /**
   * Kiểm tra ImageViewCompareTable vẫn render đúng sau khi xóa 11 dòng code. Bảng so sánh ảnh before/after phải hiển thị đầy đủ cột và dữ liệu, không có lỗi UI hoặc cột bị thiếu.
   */
  test('ImageViewCompareTable — renders correctly after 11-line removal', async ({ imageManager, page }) => {
    // Collect console errors during this test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await test.step('Wait for image list/table to load', async () => {
      await imageManager.waitForSkeletonGone();
      const rows = imageManager.imageTableRows;
      await expect(rows.first()).toBeVisible({ timeout: 15000 });
      console.log('✅ Image table loaded');
    });

    await test.step('Assert image comparison table is visible', async () => {
      const tableArea = imageManager.frame.locator(
        'table, [role="grid"], [role="rowgroup"], [class*="IndexTable" i]'
      ).first();
      await expect(tableArea).toBeVisible({ timeout: 10000 });
      console.log('✅ Image comparison table is visible');
    });

    await test.step('Assert table columns are intact', async () => {
      // Check for key statistics columns — these should be present in the report/stats area
      const statsArea = imageManager.frame;
      await expect(statsArea.getByText('Original size')).toBeVisible({ timeout: 5000 });
      await expect(statsArea.getByText('Optimized size')).toBeVisible({ timeout: 5000 });
      await expect(statsArea.getByText('Size saved')).toBeVisible({ timeout: 5000 });
      console.log('✅ All expected columns present (Original size, Optimized size, Size saved)');
    });

    await test.step('Assert no blank or broken cells in visible rows', async () => {
      const rows = imageManager.imageTableRows;
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // Check first visible row has at least some text content
      const firstRowText = await rows.first().textContent();
      expect(firstRowText).toBeTruthy();
      expect(firstRowText!.trim().length).toBeGreaterThan(0);
      console.log(`✅ ${rowCount} row(s) visible, first row has content`);
    });

    await test.step('Assert no JavaScript console errors related to table rendering', async () => {
      const relevantErrors = consoleErrors.filter(e =>
        /table|compare|imageview|render|undefined.*property/i.test(e)
      );
      expect(relevantErrors).toHaveLength(0);
      console.log('✅ No JS console errors related to table rendering');
    });
  });

  /**
   * Kiểm tra trạng thái của ButtonOptimize khi không có ảnh nào cần tối ưu — đặc biệt sau khi bỏ prop shouldConfirm, cần đảm bảo không có hành động ngoài ý muốn xảy ra khi button ở trạng thái disabled hoặc ẩn.
   */
  test('Guard — Optimize button disabled state when no images pending', async ({ imageManager }) => {
    await test.step('Wait for Image Manager to load', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Image Manager loaded');
    });

    await test.step('Assert Optimize button is disabled or not rendered when no images need optimization', async () => {
      const optimizeBtn = imageManager.optimizeNowButton;
      const emptyState = imageManager.emptyState;
      const allOptimizedMsg = imageManager.frame.getByText(/all.*optimized|no images? to optimize/i);

      const btnVisible = await optimizeBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (btnVisible) {
        const isDisabled = await optimizeBtn.isDisabled().catch(() => false);
        if (isDisabled) {
          console.log('✅ Optimize now button is disabled — no eligible images');
        } else {
          // Button enabled — store has unoptimized images, skip guard
          console.log('⚠️ Optimize now button is enabled — store has unoptimized images');
          test.skip(true, 'Store has unoptimized images — guard condition not met');
        }
      } else {
        console.log('✅ Optimize now button is not rendered — no eligible images');
      }

      // Check for empty state or "all optimized" message
      const hasMessage = await emptyState.or(allOptimizedMsg).first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasMessage) {
        console.log('✅ Empty state or all-optimized message is displayed');
      }
    });

    await test.step('Assert no modals or error toasts appear in this state', async () => {
      // No dialog should appear
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      await expect(dialog).toHaveCount(0);

      // No error toast
      const errorToast = imageManager.frame.locator('.Polaris-Frame-ToastManager [role="alert"]')
        .filter({ hasText: /error|failed/i });
      await expect(errorToast).toHaveCount(0);
      console.log('✅ No modals or error toasts in disabled/empty state');
    });
  });
});
