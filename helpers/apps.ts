import { config } from 'dotenv';

config();

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
 * Registry of all Shopify apps under test.
 *
 * App handles are read from environment variables. See `.env.example` for
 * the full list. For avadaPlaza, the deprecated APP_HANDLE is still accepted
 * as a fallback for backward compatibility.
 *
 * @example
 *   import { APPS } from '../helpers/apps';
 *   const frame = await goToApp(page, APPS.avadaPlaza.handle);
 */
export const APPS: AppRegistry = {
  avadaPlaza: {
    // APP_HANDLE is deprecated — prefer AVADA_PLAZA_HANDLE in .env
    handle: process.env.AVADA_PLAZA_HANDLE ?? process.env.APP_HANDLE ?? 'seo-pizza-app-phucdm',
    name: 'Avada Plaza',
    testDir: 'tests/avada-plaza',
  },
  seo: {
    handle: process.env.SEO_HANDLE ?? '',
    name: 'SEO',
    testDir: 'tests/seo',
  },
  blogs: {
    handle: process.env.BLOGS_HANDLE ?? '',
    name: 'Blogs',
    testDir: 'tests/blogs',
  },
};
