import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join('.auth', 'session.json');

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
