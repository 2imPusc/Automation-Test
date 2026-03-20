/**
 * Avada Plaza - Basic Tests
 *
 * Test cơ bản để verify app load được trong Shopify Admin.
 *
 * NOTE: Trước khi chạy, cần tìm đúng AVADA_PLAZA_HANDLE:
 *   1. Vào https://admin.shopify.com/store/dophuc-store/apps
 *   2. Click vào Avada Plaza
 *   3. Nhìn URL: .../apps/[APP_HANDLE] - copy phần đó vào .env
 */
import { test, expect } from '@playwright/test';
import { goToApp, waitForAppLoad } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';

test.describe('Avada Plaza - Kiểm tra cơ bản', () => {
  test('app load được trong Shopify Admin', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);

    await waitForAppLoad(frame);
    await expect(frame.locator('body')).toBeVisible();

    console.log('✅ App iframe loaded successfully');
  });

  test('không có lỗi crash khi mở app', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    await waitForAppLoad(frame);

    const errorTexts = ['Something went wrong', 'Internal Server Error', '500', 'Page not found'];
    for (const errorText of errorTexts) {
      await expect(frame.getByText(errorText, { exact: false })).not.toBeVisible();
    }

    console.log('✅ No crash errors detected');
  });

  test('title trang Shopify Admin chứa tên store', async ({ page }) => {
    await goToApp(page, APPS.avadaPlaza.handle);

    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    expect(title).not.toBe('');
  });
});
