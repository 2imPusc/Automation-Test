/**
 * Avada Plaza - Image Compress Tests
 *
 * Test 2 flow chính:
 *  1. Auto optimize (Optimize all)
 *  2. Manual compress (chọn ảnh → Compress image)
 *
 * Selectors có thể cần điều chỉnh dựa trên class thật của app.
 * Chạy `npm run test:headed` để xem visual khi debug.
 */
import { test, expect, Page, FrameLocator } from '@playwright/test';
import { goToApp } from '../../helpers/shopify';

const APP_HANDLE = 'seo-pizza-app-phucdm';

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Navigate đến Image Manager, đóng Sidekick nếu có.
 * Trả về frame của app để dùng tiếp trong test.
 */
async function goToImageManager(page: Page): Promise<FrameLocator> {
  const frame = await goToApp(page, APP_HANDLE);

  // Shopify Sidekick đôi khi tự mở — đóng lại để không che UI
  const sidekick = page.getByRole('button', { name: 'Close Sidekick' });
  const hideBtns = page.getByRole('button', { name: 'hide' });

  if (await sidekick.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidekick.click();
  } else if (await hideBtns.nth(1).isVisible({ timeout: 2000 }).catch(() => false)) {
    await hideBtns.nth(1).click();
  }

  // Click vào Image Manager trong nav
  await page.getByRole('link', { name: 'Image manager' }).click();

  // Chờ nội dung Image Manager load
  await frame.getByText('Optimize now').waitFor({ state: 'visible', timeout: 20000 });

  return frame;
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

test.describe('Avada Plaza - Image Manager', () => {
  test('trang Image Manager hiển thị đúng thông tin', async ({ page }) => {
    const frame = await goToImageManager(page);

    // Report thống kê phải hiện
    await expect(frame.getByText('Total images')).toBeVisible();
    await expect(frame.getByText('Original size')).toBeVisible();

    // Nút bắt đầu compress phải hiện
    await expect(frame.getByText('Optimize now')).toBeVisible();

    console.log('✅ Image Manager load đúng');
  });
});

test.describe('Avada Plaza - Auto Optimize', () => {
  test('click Optimize all → toast bắt đầu + progress hiện ra', async ({ page }) => {
    const frame = await goToImageManager(page);

    // Mở panel optimize
    await frame.getByText('Optimize now').click();

    // Click Optimize all
    const optimizeAllBtn = frame.getByRole('button', { name: 'Optimize all' });
    await expect(optimizeAllBtn).toBeVisible();
    await optimizeAllBtn.click();

    // ── Verify toast thông báo bắt đầu ──────────────────────────────────
    // Thử các selector phổ biến (Polaris Toast / custom)
    // Nếu không match → inspect element trong app và cập nhật selector
    const toast = frame.locator([
      '[role="alert"]',
      '[class*="toast" i]',
      '[class*="Toast" i]',
      '[class*="notification" i]',
      '[class*="snackbar" i]',
    ].join(', ')).first();

    await expect(toast).toBeVisible({ timeout: 10000 });
    console.log('✅ Toast xuất hiện sau khi click Optimize all');

    // ── Verify progress bar trong quá trình optimize ─────────────────────
    const progress = frame.locator([
      '[role="progressbar"]',
      '[class*="progress" i]',
      '[class*="Progress" i]',
    ].join(', ')).first();

    await expect(progress).toBeVisible({ timeout: 15000 });
    console.log('✅ Progress bar hiển thị trong quá trình optimize');
  });
});

test.describe('Avada Plaza - Manual Compress', () => {
  test('chọn ảnh → Compress image → skeleton → hiện kết quả', async ({ page }) => {
    const frame = await goToImageManager(page);

    // Chuyển sang mode manual
    await frame.getByText('Optimize manually').click();

    // ── Chọn ảnh đầu tiên trong danh sách ───────────────────────────────
    const firstImageCheckbox = frame.getByRole('cell', { name: 'Select Item' }).first();
    await expect(firstImageCheckbox).toBeVisible({ timeout: 10000 });
    await firstImageCheckbox.click();

    // ── Click Compress image ─────────────────────────────────────────────
    const compressBtn = frame.getByRole('button', { name: 'Compress image' });
    await expect(compressBtn).toBeVisible();
    await compressBtn.click();

    console.log('✅ Đã click Compress image');

    // ── Verify skeleton loading xuất hiện ────────────────────────────────
    const skeleton = frame.locator([
      '[class*="skeleton" i]',
      '[class*="Skeleton" i]',
      '[class*="loading" i]',
      '[aria-busy="true"]',
    ].join(', ')).first();

    await expect(skeleton).toBeVisible({ timeout: 10000 });
    console.log('✅ Skeleton loading hiện ra');

    // ── Chờ skeleton biến mất → kết quả hiện ra ─────────────────────────
    // Compress có thể mất vài giây
    await expect(skeleton).not.toBeVisible({ timeout: 60000 });
    console.log('✅ Skeleton biến mất - kết quả đã load');

    // ── Verify có kết quả compress (size giảm hoặc %) ───────────────────
    // Selector này cần inspect thêm - tìm element chứa kết quả
    // VD: "Saved X%", "X KB → Y KB", v.v.
    // TODO: cập nhật selector sau khi inspect DOM
    // await expect(frame.locator('[class*="result"]').first()).toBeVisible();
  });

  test('không chọn ảnh → button Compress image bị disabled', async ({ page }) => {
    const frame = await goToImageManager(page);

    // Chuyển sang mode manual mà KHÔNG chọn ảnh nào
    await frame.getByText('Optimize manually').click();

    // Button phải bị disabled khi chưa chọn
    const compressBtn = frame.getByRole('button', { name: 'Compress image' });
    await expect(compressBtn).toBeVisible({ timeout: 10000 });
    await expect(compressBtn).toBeDisabled();

    console.log('✅ Compress button disabled khi chưa chọn ảnh');
  });
});
