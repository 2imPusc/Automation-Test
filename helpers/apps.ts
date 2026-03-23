import { config } from 'dotenv';

config({ path: '.env' });

/** Configuration for a single Shopify app under test. */
export interface AppConfig {
  /** App handle as it appears in the Shopify Admin URL (/apps/[handle]) */
  handle: string;
  /** Human-readable app name */
  name: string;
  /** Directory containing the app's tests, relative to project root */
  testDir: string;
}

/** Registry of all Shopify apps available for testing. */
export interface AppRegistry {
  avadaPlaza: AppConfig;
  seo: AppConfig;
  blogs: AppConfig;
}

/**
 * Resolve app handle theo ENV hiện tại.
 * ENV=staging → đọc STAGING_* prefix
 * Mặc định → đọc thẳng key
 */
function handle(key: string, fallback = ''): string {
  const IS_STAGING = process.env.ENV === 'staging';
  const stagingKey = `STAGING_${key}`;
  return (IS_STAGING ? process.env[stagingKey] : process.env[key]) ?? fallback;
}

/**
 * Registry of all Shopify apps under test.
 * Handles đọc từ .env duy nhất, tự chọn staging/local theo ENV.
 *
 * @example
 *   import { APPS } from '../helpers/apps';
 *   const frame = await goToApp(page, APPS.avadaPlaza.handle);
 */
export const APPS: AppRegistry = {
  avadaPlaza: {
    handle: handle('AVADA_PLAZA_HANDLE') || process.env.APP_HANDLE || '',
    name: 'Avada Plaza',
    testDir: 'tests/avada-plaza',
  },
  seo: {
    handle: handle('SEO_HANDLE'),
    name: 'SEO',
    testDir: 'tests/seo',
  },
  blogs: {
    handle: handle('BLOGS_HANDLE'),
    name: 'Blogs',
    testDir: 'tests/blogs',
  },
};
