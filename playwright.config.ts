import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { config } from 'dotenv';

// ── Environment switching ──────────────────────────────────────────────────
// Tất cả config nằm trong 1 file .env duy nhất.
// ENV variable chỉ dùng để chọn prefix key + auth session file:
//
//   npm run test              → local   (AVADA_PLAZA_HANDLE, SEO_HANDLE, ...)
//   ENV=staging npm run test  → staging (STAGING_AVADA_PLAZA_HANDLE, ...)
//
const ENV = process.env.ENV ?? 'local';
const IS_STAGING = ENV === 'staging';

// Luôn load từ .env duy nhất
config({ path: '.env' });

// Resolve handle theo env: staging dùng STAGING_* prefix, local/prod dùng thẳng
function resolveHandle(key: string): string {
  const stagingKey = `STAGING_${key}`;
  return (IS_STAGING ? process.env[stagingKey] : process.env[key]) || '';
}

if (IS_STAGING) {
  console.log('[env] Running against: staging');
}

// Auth file riêng cho mỗi env (session login khác nhau)
const AUTH_FILE = path.join('.auth', IS_STAGING ? 'session.staging.json' : 'session.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sequential để tránh bị Shopify rate limit
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'https://admin.shopify.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Project setup: chạy 1 lần để lưu session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        headless: false, // Phải headed để login bằng Google
      },
    },
    // Project chính: chạy các test với session đã lưu
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },
  ],
});
