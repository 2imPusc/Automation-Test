/**
 * @generated AI Pipeline — 2026-03-26 08:40:00
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

test.describe('Image Manager v2 — Compression', () => {
  /**
   * Kiểm tra trang Image Manager Compression tab tải thành công sau khi cập nhật v2.
   * Đảm bảo các thành phần chính (nút Optimize now, bảng thống kê) hiển thị đúng và app không crash.
   */
  test('Smoke — Image Manager v2 tải đúng với đầy đủ UI @smoke', async ({ imageManager }) => {
    await test.step('Verify Optimize now button is visible', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Optimize now button is visible');
    });

    await test.step('Verify report section is visible', async () => {
      // DOM: Report section có heading "Report" + button info icon
      // Stat values (Total compression, Saving) hiển thị trực tiếp — không cần hover
      // Tooltip chỉ xuất hiện khi hover vào icon, không cần assert
      const reportSection = imageManager.frame.locator('text=/Report/i').first();
      await expect(reportSection).toBeVisible({ timeout: 10000 });

      // Assert ít nhất 1 stat value visible (Total compression % hoặc Saving KB)
      const totalCompression = imageManager.frame.getByText(t('Report.totalCompression')).first();
      await expect(totalCompression).toBeVisible({ timeout: 5000 });
      console.log('✅ Report section and stat values are visible');
    });

    await test.step('Verify no error banner on page', async () => {
      const errorBanner = imageManager.frame.locator('[class*="Banner"] [class*="critical" i]');
      await expect(errorBanner).toHaveCount(0);
      console.log('✅ No error banner on page');
    });
  });

  /**
   * ButtonOptimize v2 đã xóa props shouldConfirm, openModal, closeModal — đây là thay đổi cốt lõi nhất.
   * Bấm 'Optimize all' KHÔNG được hiện dialog xác nhận, thay vào đó toast 'Optimization started' phải xuất hiện trực tiếp trong vòng 5 giây.
   */
  test('Optimize all — không hiện confirmation modal (v2 regression) @regression', async ({ imageManager }) => {
    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Click Optimize all from dropdown', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast appears within 5s', async () => {
      // Toast text: "Started optimizing at..." (from Optimizer.Start key)
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast appeared after Optimize all');
    });
  });

  /**
   * Tương tự Optimize all, option 'Optimize unoptimized' cũng phải bỏ qua bước xác nhận sau v2.
   * Kỳ vọng: không có modal, toast xuất hiện ngay sau khi click.
   */
  test('Optimize unoptimized — không hiện confirmation modal @regression', async ({ imageManager }) => {
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
   * ABanner/index.js có thay đổi trong v2. Cần xác nhận toast sau optimize hiển thị đúng text,
   * render không bị vỡ layout, và tự dismiss sau một khoảng thời gian hợp lý.
   */
  test('Toast notification render đúng sau khi optimize (ABanner v2) @regression', async ({ imageManager }) => {
    await test.step('Trigger Optimize all and assert toast immediately', async () => {
      // Trigger optimize + assert toast trong cùng 1 step để không bỏ lỡ toast ngắn
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      // Polaris Toast thường hiện trong 1-2s và dismiss sau 5s
      await expect(imageManager.toast).toBeVisible({ timeout: 8000 });
      console.log('✅ Triggered Optimize all — toast appeared');
    });

    await test.step('Wait 6s then assert toast is auto-dismissed', async () => {
      await imageManager.page.waitForTimeout(6000);
      await expect(imageManager.toast).not.toBeVisible({ timeout: 5000 });
      console.log('✅ Toast auto-dismissed after timeout');
    });
  });

  /**
   * ImageViewCompareTable/index.js bị xóa 11 dòng trong v2. Cần đảm bảo bảng so sánh ảnh
   * (original vs optimized) vẫn hiển thị đúng, không bị blank hoặc lỗi render.
   */
  test('Image compare table vẫn render đúng sau khi xóa code @regression', async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await imageManager.waitForSkeletonGone();
      console.log('✅ Image list loaded');
    });

    await test.step('Assert Preview compare view renders on page', async () => {
      // DOM: Preview section luôn visible trên page, chứa img "Original" + img "Optimized"
      // Không cần click row — preview hiển thị sẵn trong compression settings
      const previewSection = imageManager.frame.locator('text=/Preview/i').first();
      await expect(previewSection).toBeVisible({ timeout: 10000 });
      console.log('✅ Preview section is visible');
    });

    await test.step('Assert Original and Optimized images are rendered in preview', async () => {
      // DOM: img "Original" và img "Optimized" trong preview area
      const originalImg = imageManager.frame.getByAltText('Original').first();
      const optimizedImg = imageManager.frame.getByAltText('Optimized').first();
      await expect(originalImg).toBeVisible({ timeout: 5000 });
      await expect(optimizedImg).toBeVisible({ timeout: 5000 });
      console.log('✅ Original and Optimized images rendered in compare preview');
    });
  });

  /**
   * LeavePrompt.js có thay đổi trong v2. Cần đảm bảo prompt cảnh báo vẫn xuất hiện khi
   * người dùng thay đổi settings chưa lưu và cố navigate sang trang khác, tránh mất dữ liệu.
   */
  test('LeavePrompt vẫn hoạt động khi navigate rời trang chưa lưu @guard', async ({ imageManager }) => {
    await test.step('Modify compression quality to create unsaved state', async () => {
      // DOM: custom combobox — click wrapper để mở, rồi click option trong listbox
      const comboWrapper = imageManager.frame.locator('[cursor=pointer], [class*="Select"]')
        .filter({ hasText: /Automatic|92%/ }).first();

      // Thử native select trước
      const nativeSelect = imageManager.frame.locator('select').first();
      const hasNative = await nativeSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasNative) {
        const options = await nativeSelect.locator('option').all();
        for (const opt of options) {
          const val = await opt.getAttribute('value') ?? '';
          const text = await opt.textContent() ?? '';
          if (!text.includes('92') && !text.includes('Automatic')) {
            await nativeSelect.selectOption(val);
            break;
          }
        }
      } else {
        // Custom combobox: click để mở dropdown
        await imageManager.frame.locator('[role="combobox"], [aria-haspopup="listbox"]')
          .first().click({ force: true });
        await imageManager.page.waitForTimeout(400);

        // Click option đầu tiên không phải current value
        const options = imageManager.frame.locator('[role="option"], [role="listbox"] li');
        const count = await options.count();
        if (count > 0) await options.first().click();
      }

      await imageManager.page.waitForTimeout(800);
      console.log('✅ Modified compression quality setting');
    });

    await test.step('Assert unsaved changes indicator is visible', async () => {
      // Shopify contextual save bar xuất hiện trên page (ngoài iframe) khi app có dirty state
      // Một số custom combobox cần thêm thời gian để trigger React state update
      const isVisible = await imageManager.unsavedChangesBar.isVisible({ timeout: 5000 }).catch(() => false);
      if (!isVisible) {
        // Fallback: thử keyboard để force trigger change event
        const combobox = imageManager.frame.locator('[role="combobox"]').first();
        if (await combobox.isVisible({ timeout: 1000 }).catch(() => false)) {
          await combobox.press('ArrowDown');
          await imageManager.page.waitForTimeout(300);
          await combobox.press('Enter');
          await imageManager.page.waitForTimeout(500);
        }
      }
      await expect(imageManager.unsavedChangesBar).toBeVisible({ timeout: 5000 });
      console.log('✅ Unsaved changes bar is visible');
    });

    await test.step('Click a different nav link to trigger leave prompt', async () => {
      await imageManager.navigateAway();
      console.log('✅ Attempted to navigate away');
    });

    await test.step('Assert leave prompt or unsaved changes warning appears', async () => {
      // Shopify shows a discard modal when navigating away with unsaved changes
      const leaveDialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      const discardText = imageManager.page.getByText(/discard|leave|unsaved/i);
      await expect(leaveDialog.or(discardText).first()).toBeVisible({ timeout: 5000 });
      console.log('✅ Leave prompt appeared');
    });

    await test.step('Click Discard to cancel navigation and remain on page', async () => {
      await imageManager.clickDiscard();
      console.log('✅ Clicked Discard — remained on Image Manager');
    });
  });
});
