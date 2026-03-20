/**
 * Avada Plaza - Settings Tests
 *
 * Test flow: mở trang Settings, kiểm tra fields, lưu cài đặt.
 */
import { test, expect } from '@playwright/test';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';
import { SettingsPage } from '../../helpers/pages/SettingsPage';

test.describe('Avada Plaza - Settings', () => {
  test('trang Settings hiển thị đúng @smoke', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const settings = new SettingsPage(page, frame);
    await settings.goTo();

    await expect(settings.saveButton).toBeVisible();
    await expect(settings.compressionQualityInput).toBeVisible();
    console.log('✅ Settings page load đúng');
  });

  test('lưu settings → toast thành công xuất hiện', async ({ page }) => {
    const frame = await goToApp(page, APPS.avadaPlaza.handle);
    const settings = new SettingsPage(page, frame);
    await settings.goTo();

    await settings.clickSave();
    await settings.waitForSuccessToast();

    await expect(settings.successToast).toBeVisible();
    console.log('✅ Toast "Settings saved" xuất hiện');
  });
});
