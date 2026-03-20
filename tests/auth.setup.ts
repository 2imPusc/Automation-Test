import { test as setup } from '@playwright/test';
import path from 'path';

const ENV = process.env.ENV ?? 'local';
const AUTH_FILE = path.join('.auth', ENV === 'local' ? 'session.json' : `session.${ENV}.json`);

setup('lưu session Shopify', async ({ page }) => {
  // Mở trang login Shopify
  await page.goto('https://admin.shopify.com');

  // Chờ user login thủ công (Google OAuth không thể tự động hoá)
  // User cần login xong thì test sẽ tiếp tục
  await page.waitForURL(/admin\.shopify\.com\/store\//, { timeout: 120000 });

  // Lưu session để dùng lại
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Session saved to ${AUTH_FILE}`);
});
