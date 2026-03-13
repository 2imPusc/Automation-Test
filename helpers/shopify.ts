/**
 * Shopify Test Helpers
 *
 * Các utility function để làm việc với Shopify Admin + embedded app iframe
 */
import { config } from 'dotenv';
import { Page, FrameLocator } from '@playwright/test';

// Load environment variables
config();

export const STORE_HANDLE = process.env.STORE_HANDLE || 'dophuc-store';
export const APP_HANDLE = process.env.APP_HANDLE || 'seo-pizza-app-phucdm';
export const ADMIN_BASE = `https://admin.shopify.com/store/${STORE_HANDLE}`;

/**
 * Selector của iframe chứa embedded app trong Shopify Admin.
 * Shopify dùng cố định: iframe[name="app-iframe"]
 */
const APP_IFRAME_SELECTOR = 'iframe[name="app-iframe"]';

/**
 * Navigate đến một app trong Shopify Admin và trả về FrameLocator của iframe.
 *
 * @param page        - Playwright Page instance
 * @param appHandle   - App handle trong Shopify (lấy từ URL trên admin)
 *                      VD: 'avada-image-optimizer'
 * @returns           FrameLocator để interact với nội dung bên trong iframe
 *
 * @example
 *   const frame = await goToApp(page, 'avada-image-optimizer');
 *   await expect(frame.getByText('Dashboard')).toBeVisible();
 */
export async function goToApp(page: Page, appHandle: string): Promise<FrameLocator> {
  await page.goto(`${ADMIN_BASE}/apps/${appHandle}/embed`);

  // Chờ iframe xuất hiện trong DOM
  await page.waitForSelector(APP_IFRAME_SELECTOR, { timeout: 30000 });

  // Chờ iframe có src (đang load content, không phải blank)
  await page.waitForFunction(
    (selector) => {
      const iframe = document.querySelector(selector) as HTMLIFrameElement;
      return iframe && iframe.src && iframe.src !== 'about:blank';
    },
    APP_IFRAME_SELECTOR,
    { timeout: 30000 }
  );

  return page.frameLocator(APP_IFRAME_SELECTOR);
}

/**
 * Lấy FrameLocator của app iframe mà không navigate (dùng khi đã ở đúng trang).
 */
export function getAppFrame(page: Page): FrameLocator {
  return page.frameLocator(APP_IFRAME_SELECTOR);
}

/**
 * Chờ nội dung bên trong iframe load xong.
 * Dùng sau goToApp() nếu cần chờ thêm.
 */
export async function waitForAppLoad(frame: FrameLocator): Promise<void> {
  // Chờ body visible trong iframe
  await frame.locator('body').waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * Navigate đến trang Apps list trong Shopify Admin.
 * Hữu ích để tìm app handle (nhìn URL khi click vào app).
 */
export async function goToAppsList(page: Page): Promise<void> {
  await page.goto(`${ADMIN_BASE}/apps`);
  await page.waitForLoadState('domcontentloaded');
}
