/**
 * Avada Plaza - Image Compress Tests
 *
 * Test 2 flow chính:
 *  1. Auto optimize (Optimize all)
 *  2. Manual compress (chọn ảnh → Compress image)
 *
 * Chạy `npm run test:headed` để debug visual.
 */
import { test, expect } from '../../fixtures';

test.describe('Avada Plaza - Image Manager', () => {
  test('trang Image Manager hiển thị đúng thông tin @smoke', async ({ imageManager }) => {
    await expect(imageManager.frame.getByText('Total images')).toBeVisible();
    await expect(imageManager.frame.getByText('Original size')).toBeVisible();
    await expect(imageManager.frame.getByText('Optimize now')).toBeVisible();

    console.log('✅ Image Manager load đúng');
  });
});

test.describe('Avada Plaza - Auto Optimize', () => {
  test('click Optimize all → toast bắt đầu + progress hiện ra', async ({ imageManager }) => {
    await imageManager.clickOptimizeNow();
    await imageManager.clickOptimizeAll();

    await expect(imageManager.toast).toBeVisible({ timeout: 10000 });
    console.log('✅ Toast xuất hiện sau khi click Optimize all');

    await expect(imageManager.progress).toBeVisible({ timeout: 15000 });
    console.log('✅ Progress bar hiển thị trong quá trình optimize');
  });
});

test.describe('Avada Plaza - Manual Compress', () => {
  test('chọn ảnh → Compress image → skeleton → hiện kết quả', async ({ imageManager }) => {
    await imageManager.switchToManualMode();
    await imageManager.selectFirstImage();
    await imageManager.clickCompressImage();
    console.log('✅ Đã click Compress image');

    await expect(imageManager.skeleton).toBeVisible({ timeout: 10000 });
    console.log('✅ Skeleton loading hiện ra');

    await imageManager.waitForSkeletonGone();
    console.log('✅ Skeleton biến mất - kết quả đã load');
  });

  test('không chọn ảnh → button Compress image bị disabled', async ({ imageManager }) => {
    await imageManager.switchToManualMode();

    await expect(imageManager.compressButton).toBeVisible({ timeout: 10000 });
    await expect(imageManager.compressButton).toBeDisabled();

    console.log('✅ Compress button disabled khi chưa chọn ảnh');
  });
});
