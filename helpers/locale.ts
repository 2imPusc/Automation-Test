/**
 * Locale Helper — Load translations from app source files.
 *
 * Resolves i18n keys (e.g. "ButtonOptimize.labelOtm") to the actual
 * translated text based on the current test locale.
 *
 * Usage:
 *   import { t, loadLocale } from '../helpers/locale';
 *
 *   // In test setup or fixture:
 *   loadLocale('avadaPlaza', 'de');  // or process.env.TEST_LOCALE
 *
 *   // In test:
 *   await frame.getByText(t('ButtonOptimize.labelOtm')).click();
 *   // → clicks "Jetzt optimieren" (DE) or "Optimize now" (EN)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { config } from 'dotenv';

config({ path: '.env' });

// Registry: appKey → locale file paths
const LOCALE_REGISTRY: Record<string, string> = {
  avadaPlaza: '~/avada-image-optimizer/packages/assets/src/locale/translations',
  seo: '~/seo/src/locale/translations',
  blogs: '~/blogs/src/locale/translations',
};

function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

// Loaded translations cache
let currentTranslations: Record<string, unknown> = {};
let currentLocale = 'en';
let fallbackTranslations: Record<string, unknown> = {};

/**
 * Load locale translations for a given app.
 *
 * @param appKey - App key from registry (avadaPlaza, seo, blogs)
 * @param locale - Locale code (en, de, fr, vi, etc.). Defaults to TEST_LOCALE env var or 'en'.
 */
export function loadLocale(appKey: string, locale?: string): void {
  const resolvedLocale = locale || process.env.TEST_LOCALE || 'en';
  const basePath = expandHome(LOCALE_REGISTRY[appKey] || LOCALE_REGISTRY.avadaPlaza);

  // Always load English (origin.json) as fallback
  const originPath = path.join(basePath, 'origin.json');
  if (fs.existsSync(originPath)) {
    fallbackTranslations = JSON.parse(fs.readFileSync(originPath, 'utf-8'));
  }

  // Load target locale
  if (resolvedLocale === 'en' || resolvedLocale === 'origin') {
    currentTranslations = fallbackTranslations;
  } else {
    const localePath = path.join(basePath, `${resolvedLocale}.json`);
    if (fs.existsSync(localePath)) {
      currentTranslations = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
    } else {
      console.warn(`[locale] ${localePath} not found, falling back to English`);
      currentTranslations = fallbackTranslations;
    }
  }

  currentLocale = resolvedLocale;
}

/**
 * Resolve a dot-notation i18n key to the translated text.
 *
 * @param key - Dot-notation key, e.g. "ButtonOptimize.labelOtm"
 * @returns The translated string, or the key itself if not found.
 *
 * @example
 *   t('ButtonOptimize.labelOtm')     // → "Jetzt optimieren" (DE)
 *   t('ImageManager.title')          // → "Kompression" (DE)
 *   t('ImageManager.tabs.compression') // → "Kompression" (DE)
 */
export function t(key: string): string {
  const value = resolveKey(currentTranslations, key)
    || resolveKey(fallbackTranslations, key)
    || key;
  return String(value);
}

/**
 * Get the English text for a key (always from origin.json).
 * Useful for assertions that verify translation exists.
 */
export function tEn(key: string): string {
  return String(resolveKey(fallbackTranslations, key) || key);
}

/**
 * Create a regex that matches BOTH the current locale text and English fallback.
 * Useful for selectors that need to work regardless of locale.
 *
 * @example
 *   frame.locator(tRegex('ButtonOptimize.labelOtm'))
 *   // → matches "Optimize now" OR "Jetzt optimieren"
 */
export function tRegex(key: string): RegExp {
  const localeText = resolveKey(currentTranslations, key);
  const enText = resolveKey(fallbackTranslations, key);

  const texts = new Set<string>();
  if (localeText) texts.add(escapeRegex(String(localeText)));
  if (enText) texts.add(escapeRegex(String(enText)));

  if (texts.size === 0) return new RegExp(escapeRegex(key), 'i');
  return new RegExp(Array.from(texts).join('|'), 'i');
}

/**
 * Return a Playwright-compatible `text=/regex/i` locator string.
 * Use this directly in `frame.locator(tLoc('key'))`.
 *
 * @example
 *   frame.locator(tLoc('ButtonOptimize.labelOtm')).click()
 *   // → frame.locator('text=/Jetzt optimieren|Optimize now/i')
 */
export function tLoc(key: string): string {
  return `text=/${tRegex(key).source}/i`;
}

/** Get current locale code */
export function getLocale(): string {
  return currentLocale;
}

/** List available locales for an app */
export function availableLocales(appKey: string): string[] {
  const basePath = expandHome(LOCALE_REGISTRY[appKey] || LOCALE_REGISTRY.avadaPlaza);
  if (!fs.existsSync(basePath)) return ['en'];
  return fs.readdirSync(basePath)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', '').replace('origin', 'en'));
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveKey(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Auto-load on import if TEST_LOCALE is set
const autoApp = process.env.TEST_APP || 'avadaPlaza';
const autoLocale = process.env.TEST_LOCALE;
if (autoLocale) {
  loadLocale(autoApp, autoLocale);
} else {
  // Default: load English
  loadLocale(autoApp, 'en');
}
