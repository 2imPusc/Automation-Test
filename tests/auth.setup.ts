/**
 * Auth Setup - Chạy 1 lần để lưu session Shopify
 *
 * Cách dùng:
 *   npm run auth
 *
 * - Mở browser headed
 * - Bạn login thủ công bằng Google
 * - Session tự động lưu vào .auth/session.json
 * - Các test sau dùng lại session này (không cần login lại)
 */
import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), '.auth', 'session.json');
const ADMIN_URL = 'https://admin.shopify.com/store/dophuc-store';

setup('lưu session Shopify', async ({ page, context }) => {
  // Tăng timeout lên 5 phút cho toàn bộ test này (override config global)
  setup.setTimeout(300000);

  // Kiểm tra nếu session đã tồn tại thì bỏ qua
  if (fs.existsSync(AUTH_FILE)) {
    console.log('\n✅ Session đã tồn tại tại .auth/session.json');
    console.log('💡 Nếu muốn đăng nhập lại: xóa file .auth/session.json rồi chạy lại\n');
    return;
  }

  console.log('\n🚀 Mở Shopify Admin...');
  console.log('⏳ Hãy login bằng Google account trong cửa sổ browser vừa mở');
  console.log('📌 Nếu có passkey/2FA → hoàn thành nốt trong browser');
  console.log('📌 Sau khi vào được trang dashboard Shopify, script sẽ tự động lưu session\n');

  await page.goto(ADMIN_URL);

  // Chờ user login xong (bao gồm cả passkey/2FA) và đến được admin dashboard
  // Timeout 4 phút để có đủ thời gian xử lý mọi bước auth
  await page.waitForURL(/admin\.shopify\.com\/store\/dophuc-store/, {
    timeout: 240000,
  });

  // Chờ trang load xong
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // Ignore networkidle timeout - page có thể vẫn đang load một số resource
  });

  // Tạo thư mục .auth nếu chưa có
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Lưu session
  await context.storageState({ path: AUTH_FILE });

  console.log(`\n✅ Session đã lưu tại: ${AUTH_FILE}`);
  console.log('🎯 Giờ có thể chạy test: npm test\n');
});
