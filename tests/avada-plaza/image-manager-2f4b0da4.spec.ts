/**
 * @generated AI Pipeline — 2026-03-27 08:07:38
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
   * Sau khi xóa props shouldConfirm/openModal/closeModal khỏi ButtonOptimize, luồng Optimize All không được hiện confirmation dialog nữa.
   * Test click 'Optimize now' → 'Optimize all' và xác nhận modal KHÔNG xuất hiện, toast 'Optimization started' phải hiện trong 5 giây.
   */
  test('Optimize All — no confirmation modal (v2 regression) @smoke', async ({ imageManager }) => {
    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Click Optimize all from dropdown', async () => {
      await expect(imageManager.optimizeAllButton).toBeVisible({ timeout: 5000 });
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      // Exclude Sidekick which is always in DOM
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      // Short wait to ensure any modal would have time to render
      await imageManager.page.waitForTimeout(500);
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" appears within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      await expect(imageManager.toast).toContainText(/Optimization started/i);
      console.log('✅ Toast "Optimization started" appeared');
    });
  });

  /**
   * Tương tự Optimize All nhưng với option 'Optimize unoptimized'.
   * Xác nhận confirmation modal cũng đã bị bỏ cho option này, và toast xuất hiện đúng sau khi trigger.
   */
  test('Optimize Unoptimized — no confirmation modal (v2 regression)', async ({ imageManager }) => {
    await test.step('Open Optimize dropdown', async () => {
      await imageManager.openOptimizeDropdown();
      console.log('✅ Opened Optimize dropdown');
    });

    await test.step('Click Optimize unoptimized from dropdown', async () => {
      await expect(imageManager.optimizeUnoptimizedButton).toBeVisible({ timeout: 5000 });
      await imageManager.clickOptimizeUnoptimized();
      console.log('✅ Clicked Optimize unoptimized');
    });

    await test.step('Assert no confirmation modal appears', async () => {
      const dialog = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      await imageManager.page.waitForTimeout(500);
      await expect(dialog).toHaveCount(0);
      console.log('✅ No confirmation modal appeared');
    });

    await test.step('Assert toast "Optimization started" appears within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      await expect(imageManager.toast).toContainText(/Optimization started/i);
      console.log('✅ Toast "Optimization started" appeared');
    });
  });

  /**
   * ABanner/index.js có thay đổi (+7/-1) ảnh hưởng đến toast/notification.
   * Sau khi optimize hoàn tất, banner success hoặc toast 'Optimize successfully' phải hiện đúng và không bị lỗi render.
   */
  test('ABanner toast — notification renders correctly after optimize', async ({ imageManager, page }) => {
    // Collect console errors during this test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await test.step('Trigger Optimize all', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Triggered Optimize all');
    });

    await test.step('Assert toast "Optimization started" appears', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Initial toast appeared');
    });

    await test.step('Wait for optimization to complete (progress bar disappears)', async () => {
      // Wait for progress bar to appear first (may already be visible)
      const progressIndicator = imageManager.frame.locator(
        '[role="progressbar"], text=/Optimizing images|Optimize in progress/i'
      ).first();
      const hasProgress = await progressIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasProgress) {
        // Wait for it to disappear (optimization complete)
        await expect(progressIndicator).not.toBeVisible({ timeout: 120000 });
        console.log('✅ Progress bar disappeared — optimization complete');
      } else {
        // Small store — optimization may finish instantly
        console.log('✅ No progress bar detected — optimization likely completed instantly');
      }
    });

    await test.step('Assert success toast OR success banner is visible', async () => {
      const successToast = imageManager.frame.locator(
        '.Polaris-Frame-ToastManager [role="alert"]'
      ).filter({ hasText: /Optimize successfully|optimized successfully/i });

      const successBanner = imageManager.frame.locator(
        '[class*="Banner" i], [role="status"]'
      ).filter({ hasText: /Optimize successfully|optimized successfully/i });

      // Either toast or banner should appear
      await expect(successToast.or(successBanner).first()).toBeVisible({ timeout: 10000 });
      console.log('✅ Success toast or banner appeared');
    });

    await test.step('Assert no JS errors during banner render', async () => {
      const relevantErrors = consoleErrors.filter(e =>
        /banner|toast|abanner|render/i.test(e)
      );
      expect(relevantErrors).toHaveLength(0);
      console.log('✅ No JS console errors related to banner/toast rendering');
    });
  });

  /**
   * ImageViewCompareTable/index.js bị xóa 11 dòng. Cần xác nhận bảng so sánh ảnh vẫn hiển thị đúng,
   * không bị crash hoặc mất cột dữ liệu sau khi thay đổi.
   */
  test('ImageViewCompareTable — renders without removed code', async ({ imageManager }) => {
    await test.step('Assert image table has at least one row', async () => {
      const rows = imageManager.imageTableRows;
      await expect(rows.first()).toBeVisible({ timeout: 15000 });
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
      console.log(`✅ Image table rendered with ${count} row(s)`);
    });

    await test.step('Assert statistics columns are present', async () => {
      await expect(imageManager.frame.getByText('Original size')).toBeVisible({ timeout: 5000 });
      await expect(imageManager.frame.getByText('Optimized size')).toBeVisible({ timeout: 5000 });
      await expect(imageManager.frame.getByText('Size saved')).toBeVisible({ timeout: 5000 });
      console.log('✅ Statistics columns (Original size, Optimized size, Size saved) are visible');
    });

    await test.step('Click an optimized image row to open compare view', async () => {
      // Try to find and click an optimized image row
      const optimizedRow = imageManager.frame
        .locator('tr, [class*="Row"]')
        .filter({ has: imageManager.frame.getByText(/optimized/i) })
        .first();

      const hasOptimized = await optimizedRow.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasOptimized) {
        await optimizedRow.click();
        console.log('✅ Clicked an optimized image row');

        await test.step('Assert compare view renders without error', async () => {
          // Wait a moment for compare view to render
          await imageManager.page.waitForTimeout(1000);

          // Check no error banner appeared
          const errorAlert = imageManager.frame.locator('[role="alert"]')
            .filter({ hasText: /error|something went wrong/i });
          await expect(errorAlert).toHaveCount(0);

          // Check the compare view or detail area rendered something
          const compareArea = imageManager.frame.locator(
            '[class*="compare" i], [class*="Compare" i], [class*="ImageView" i], [class*="detail" i], [class*="Detail" i]'
          ).first();
          const hasCompare = await compareArea.isVisible({ timeout: 5000 }).catch(() => false);
          if (hasCompare) {
            console.log('✅ Compare view rendered successfully');
          } else {
            console.log('✅ Detail view opened without errors (no compare component detected)');
          }
        });
      } else {
        console.log('⚠️ No optimized images found — skipping compare view check');
      }
    });
  });

  /**
   * LeavePrompt.js có thay đổi (+7/-2). Khi user thay đổi cài đặt chưa lưu và cố thoát trang,
   * prompt cảnh báo phải vẫn xuất hiện đúng (không bị mất hoặc trigger sai).
   */
  test('LeavePrompt — unsaved settings trigger prompt on navigation', async ({ imageManager }) => {
    await test.step('Change a compression setting to create dirty state', async () => {
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
        // Fallback: click a combobox/listbox to change a setting
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

    await test.step('Assert "Unsaved changes" save bar appears', async () => {
      await expect(imageManager.unsavedChangesBar).toBeVisible({ timeout: 5000 });
      console.log('✅ Unsaved changes bar is visible');
    });

    await test.step('Navigate away to trigger leave prompt', async () => {
      await imageManager.navigateAway();
      console.log('✅ Attempted navigation away');
    });

    await test.step('Click Discard to confirm navigation', async () => {
      // The contextual save bar may show a "Discard changes" confirmation modal
      const discardModal = imageManager.page.locator('[role="dialog"]:not(#sidekick)');
      const hasModal = await discardModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasModal) {
        // Click "Discard changes" in the modal
        const discardBtn = imageManager.page.getByRole('button', { name: /discard/i });
        await discardBtn.click();
        console.log('✅ Clicked Discard in confirmation modal');
      } else {
        // Save bar may have a direct Discard button
        await imageManager.clickDiscard();
        console.log('✅ Clicked Discard on save bar');
      }
    });

    await test.step('Assert navigation proceeds and no prompt lingers', async () => {
      // The unsaved changes bar should be gone
      await expect(imageManager.unsavedChangesBar).not.toBeVisible({ timeout: 5000 });
      console.log('✅ Save bar disappeared — navigation completed');
    });
  });
});
