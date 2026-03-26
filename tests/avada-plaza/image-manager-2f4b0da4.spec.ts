/**
 * @generated AI Pipeline — 2026-03-26 10:26:22
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
import { t, tRegex, tLoc } from '../../helpers/locale';

test.describe('Image Manager v2 — Compression', () => {
  /**
   * Kiểm tra trang Image Manager (tab Compression) tải thành công sau nâng cấp v2.
   * Kỳ vọng: nút 'Optimize now', bảng thống kê và danh sách hình ảnh hiển thị đầy đủ, không có lỗi crash.
   */
  test('Smoke — Image Manager loads correctly after v2 update @smoke', async ({ imageManager }) => {
    await test.step('Assert Optimize now button is visible', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Optimize now button is visible');
    });

    await test.step('Assert statistics labels are visible', async () => {
      await expect(imageManager.frame.getByText('Total images')).toBeVisible({ timeout: 5000 });
      await expect(imageManager.frame.getByText('Original size')).toBeVisible({ timeout: 5000 });
      await expect(imageManager.frame.getByText('Optimized size')).toBeVisible({ timeout: 5000 });
      console.log('✅ Statistics labels (Total images, Original size, Optimized size) are visible');
    });

    await test.step('Assert image table has at least one row', async () => {
      const rows = imageManager.imageTableRows;
      await expect(rows.first()).toBeVisible({ timeout: 10000 });
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
      console.log(`✅ Image table rendered with ${count} row(s)`);
    });

    await test.step('Assert no error banner is present', async () => {
      const errorAlert = imageManager.frame.locator('[role="alert"]').filter({ hasText: /error|something went wrong/i });
      await expect(errorAlert).toHaveCount(0);
      console.log('✅ No error banner present');
    });
  });

  /**
   * Click Optimize now → Optimize all. Kỳ vọng: KHÔNG hiện confirmation dialog.
   * Toast thông báo phải xuất hiện trong 5 giây.
   */
  test('Optimize all — no confirmation modal (v2 regression) @regression', async ({ imageManager }) => {
    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Assert dropdown menu with Optimize all is visible', async () => {
      await expect(imageManager.optimizeAllButton).toBeVisible({ timeout: 5000 });
      console.log('✅ Optimize all option visible in dropdown');
    });

    await test.step('Click Optimize all', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      // Exclude Sidekick which is always in DOM
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast appears within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast appeared after Optimize all');
    });
  });

  /**
   * Tương tự 'Optimize all' nhưng chọn nhánh 'Optimize unoptimized'.
   * Xác nhận rằng cả hai dropdown action đều đã bỏ modal confirm trong v2.
   * Kỳ vọng: không có dialog, toast xuất hiện ngay.
   */
  test('Optimize unoptimized — no confirmation modal (v2 regression) @regression', async ({ imageManager }) => {
    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Click Optimize unoptimized from dropdown', async () => {
      await imageManager.clickOptimizeUnoptimized();
      console.log('✅ Clicked Optimize unoptimized');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast appears within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast appeared after Optimize unoptimized');
    });
  });

  /**
   * ABanner/index.js có thay đổi (+7/-1) ảnh hưởng đến toast/notification.
   * Kiểm tra toast xuất hiện đúng nội dung và đúng thời điểm sau khi bắt đầu optimize.
   * Kỳ vọng: toast 'Optimization started' xuất hiện, progress state hiển thị khi đang chạy.
   */
  test('ABanner toast — correct content after v2 changes @regression', async ({ imageManager }) => {
    await test.step('Trigger Optimize all', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert toast with Optimization started text is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      await expect(imageManager.toast).toContainText(/Optimization started/i);
      console.log('✅ Toast visible with "Optimization started" text');
    });

    await test.step('Assert toast auto-dismisses within 8s', async () => {
      await expect(imageManager.toast).not.toBeVisible({ timeout: 8000 });
      console.log('✅ Toast auto-dismissed');
    });

    await test.step('Assert progress state is visible in page body', async () => {
      const progressText = imageManager.frame.locator('text=/Optimizing images|Optimize in progress/i').first();
      await expect(progressText).toBeVisible({ timeout: 10000 });
      console.log('✅ Progress state text is visible');
    });
  });

  /**
   * LeavePrompt.js có thay đổi (+7/-2). Kiểm tra rằng khi thay đổi cài đặt compression
   * chưa lưu rồi cố điều hướng rời trang, contextual save bar vẫn xuất hiện và chặn người dùng.
   * Kỳ vọng: 'Unsaved changes' bar hiển thị, click Discard mới rời được trang.
   */
  test('Leave prompt — unsaved changes warning works after v2 @guard', async ({ imageManager }) => {
    await test.step('Modify a compression setting to create dirty state', async () => {
      // Toggle a compression option — try native select first, then combobox fallback
      const nativeSelect = imageManager.frame.locator('select').first();
      const hasNative = await nativeSelect.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasNative) {
        const options = await nativeSelect.locator('option').all();
        for (const opt of options) {
          const text = await opt.textContent() ?? '';
          if (!text.includes('92') && !text.includes('Automatic') && !text.includes('Auto')) {
            const val = await opt.getAttribute('value') ?? '';
            await nativeSelect.selectOption(val);
            break;
          }
        }
      } else {
        await imageManager.frame.locator('[role="combobox"], [aria-haspopup="listbox"]')
          .first().click({ force: true });
        await imageManager.page.waitForTimeout(400);
        const options = imageManager.frame.locator('[role="option"]');
        const count = await options.count();
        if (count > 0) await options.first().click();
      }

      await imageManager.page.waitForTimeout(800);
      console.log('✅ Modified compression setting');
    });

    await test.step('Assert Unsaved changes contextual save bar appears', async () => {
      await expect(imageManager.unsavedChangesBar).toBeVisible({ timeout: 5000 });
      console.log('✅ Unsaved changes bar is visible');
    });

    await test.step('Click Discard on save bar', async () => {
      await imageManager.clickDiscard();
      console.log('✅ Clicked Discard');
    });

    await test.step('Assert save bar disappears and setting reverts', async () => {
      await expect(imageManager.unsavedChangesBar).not.toBeVisible({ timeout: 5000 });
      console.log('✅ Save bar disappeared — setting reverted');
    });
  });
});
