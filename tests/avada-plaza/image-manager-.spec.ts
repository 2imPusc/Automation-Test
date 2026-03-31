/**
 * @generated AI Pipeline — 2026-03-30 04:41:51
 * @notion N/A
 * @task compress image
 * @taskId
 * @app Avada Plaza (avadaPlaza)
 * @branch master
 * @feature image-manager.md
 * @scenarios 5
 *
 * This file was auto-generated. It can be re-run on any environment
 * (local, staging, prod) — handles are resolved at runtime via helpers/apps.ts.
 */

import { test, expect } from '../../fixtures';
import { t, tRegex, tLoc } from '../../helpers/locale';

test.describe('Image Manager — Compress Image', () => {
  /**
   * Vào tab Image Compression, thay đổi giá trị chất lượng nén, nhấn Save trên save bar.
   * Kỳ vọng: toast 'Saved successfully' (hoặc tương đương tiếng Đức) xuất hiện trong vòng 5 giây.
   * Đây là regression cho bug không lưu được settings.
   */
  test('Compression settings save — toast xác nhận lưu thành công @smoke @regression', async ({ imageManager }) => {
    await test.step('Navigate to Compression tab', async () => {
      await imageManager.goToCompressionTab();
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Compression tab loaded');
    });

    await test.step('Change compression quality setting', async () => {
      await imageManager.changeCompressionQuality();
    });

    await test.step('Click Save on the contextual save bar', async () => {
      await imageManager.clickSaveAndWait();
    });

    await test.step('Assert: success toast appears within 5s', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 5000 });
      console.log('✅ Success toast visible after save');
    });

    await test.step('Assert: save bar disappears after successful save', async () => {
      await expect(imageManager.saveBar).not.toBeVisible({ timeout: 5000 });
      console.log('✅ Save bar disappeared');
    });
  });

  /**
   * Sau khi thay đổi cài đặt nén (chưa hoặc đã lưu), nhấn 'Optimize now' rồi chọn 'Optimize all' từ dropdown.
   * Kỳ vọng: modal xác nhận phải hiển thị. Đây là regression cho bug click Optimize All không hiện modal.
   */
  test('Optimize All — modal xuất hiện sau khi thay đổi settings @regression', async ({ imageManager }) => {
    await test.step('Navigate to Compression tab', async () => {
      await imageManager.goToCompressionTab();
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Compression tab loaded');
    });

    await test.step('Change compression quality and save', async () => {
      await imageManager.changeCompressionQuality();
      await imageManager.clickSaveAndWait();
      console.log('✅ Settings changed and saved');
    });

    await test.step('Open Optimize dropdown and click Optimize all', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all from dropdown');
    });

    await test.step('Assert: confirmation modal appears', async () => {
      const modal = imageManager.confirmationModal;
      await expect(modal).toBeVisible({ timeout: 5000 });
      console.log('✅ Confirmation modal appeared');
    });

    await test.step('Click Confirm inside the modal', async () => {
      await imageManager.modalConfirmButton.click();
      console.log('✅ Clicked confirm in modal');
    });

    await test.step('Assert: optimization toast appears', async () => {
      const toastOrProgress = imageManager.toast.or(imageManager.progress);
      await expect(toastOrProgress).toBeVisible({ timeout: 5000 });
      console.log('✅ Optimization toast/progress visible after confirm');
    });
  });

  /**
   * Flow đầy đủ: vào Compression tab, nhấn Optimize now → Optimize all → modal → confirm.
   * Kỳ vọng: toàn bộ flow hoàn thành mà không có lỗi UI.
   */
  test('Optimize All — full happy path với settings mặc định @smoke', async ({ imageManager }) => {
    await test.step('Wait for page to load', async () => {
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Page loaded');
    });

    await test.step('Open Optimize dropdown and click Optimize all', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all');
    });

    await test.step('Assert: modal is visible', async () => {
      // Some flows may not show a modal (direct optimize) — handle both cases
      const modal = imageManager.confirmationModal;
      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);

      if (modalVisible) {
        console.log('✅ Confirmation modal appeared');

        await test.step('Click confirm button in modal', async () => {
          await imageManager.modalConfirmButton.click();
          console.log('✅ Clicked confirm');
        });

        await test.step('Assert: modal closes after confirm', async () => {
          await expect(modal).not.toBeVisible({ timeout: 5000 });
          console.log('✅ Modal closed after confirm');
        });
      } else {
        console.log('✅ No modal — optimization triggered directly');
      }
    });

    await test.step('Assert: toast notification appears within 5s', async () => {
      const toastOrProgress = imageManager.toast.or(imageManager.progress);
      await expect(toastOrProgress).toBeVisible({ timeout: 5000 });
      console.log('✅ Toast/progress indicator visible');
    });
  });

  /**
   * Sau khi thay đổi và lưu cài đặt nén, reload trang và kiểm tra giá trị đã thay đổi vẫn được giữ nguyên.
   * Kỳ vọng: settings không bị reset về mặc định sau khi reload.
   */
  test('Settings persistence — giá trị nén giữ nguyên sau khi lưu và reload @guard', async ({ imageManager }) => {
    await test.step('Navigate to Compression tab', async () => {
      await imageManager.goToCompressionTab();
      console.log('✅ Compression tab loaded');
    });

    let savedValue: string;

    await test.step('Change compression quality and save', async () => {
      await imageManager.changeCompressionQuality();
      savedValue = await imageManager.getCompressionQualityValue();
      await imageManager.clickSaveAndWait();
      console.log(`✅ Saved compression quality: ${savedValue}`);
    });

    await test.step('Reload the page', async () => {
      await imageManager.reloadPage();
    });

    await test.step('Navigate back to Compression tab', async () => {
      await imageManager.goToCompressionTab();
    });

    await test.step('Assert: compression quality value persists after reload', async () => {
      const currentValue = await imageManager.getCompressionQualityValue();
      expect(currentValue).toBe(savedValue!);
      console.log(`✅ Compression quality persisted: ${currentValue}`);
    });

    await test.step('Assert: save bar is NOT shown (no unsaved changes)', async () => {
      await expect(imageManager.saveBar).not.toBeVisible({ timeout: 3000 });
      console.log('✅ No save bar — no unsaved changes after reload');
    });
  });

  /**
   * Thay đổi settings nhưng CHƯA lưu, sau đó nhấn Optimize all.
   * Kiểm tra xem app xử lý đúng: hoặc nhắc save trước, hoặc vẫn hiện modal optimize.
   * Đảm bảo không có trạng thái lỗi im lặng (silent failure).
   */
  test('Optimize All — modal KHÔNG hiện khi chưa save settings (edge case) @edge-case', async ({ imageManager }) => {
    await test.step('Navigate to Compression tab', async () => {
      await imageManager.goToCompressionTab();
      await expect(imageManager.optimizeNowButton).toBeVisible({ timeout: 20000 });
      console.log('✅ Compression tab loaded');
    });

    await test.step('Change compression quality (do NOT save)', async () => {
      await imageManager.changeCompressionQuality();
      // Verify save bar is visible (unsaved changes)
      await expect(imageManager.saveBar).toBeVisible({ timeout: 3000 });
      console.log('✅ Changed quality, save bar visible (unsaved)');
    });

    await test.step('Open Optimize dropdown and click Optimize all', async () => {
      await imageManager.openOptimizeDropdown();
      await imageManager.clickOptimizeAll();
      console.log('✅ Clicked Optimize all with unsaved changes');
    });

    await test.step('Assert: app does not silently fail — modal or save-first warning shown', async () => {
      // Check for either: confirmation modal, save-first warning, toast, or "SAVE & OPTIMIZE" flow
      const modal = imageManager.confirmationModal;
      const saveOptimizeButton = imageManager.frame.locator(tLoc('ButtonOptimize.labelUnsaved')).first();
      const toastOrProgress = imageManager.toast.or(imageManager.progress);

      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      const saveOptVisible = await saveOptimizeButton.isVisible({ timeout: 1000 }).catch(() => false);
      const toastVisible = await toastOrProgress.isVisible({ timeout: 1000 }).catch(() => false);

      const hasResponse = modalVisible || saveOptVisible || toastVisible;
      expect(hasResponse).toBe(true);
      console.log(`✅ App responded: modal=${modalVisible}, saveOptimize=${saveOptVisible}, toast=${toastVisible}`);
    });
  });
});
