#!/usr/bin/env node
/**
 * Live DOM Probe — Query real app DOM for selector-ready info on specific elements.
 *
 * Mở Shopify app bằng Playwright, tìm element theo text/selector trên DOM thật,
 * trả về danh sách Playwright selectors đề xuất (tốt nhất → xấu nhất).
 *
 * Dùng khi AI sinh selector sai — chạy probe để lấy selector đúng từ runtime DOM.
 *
 * Usage:
 *   npm run probe -- --app avadaPlaza --page image-manager --query "Optimize now"
 *   npm run probe -- --app avadaPlaza --query ".Avada-Optimize-Button"
 *   npm run probe -- --app avadaPlaza --page home --query "button"  (list all buttons)
 *   npm run probe -- --app avadaPlaza --page image-manager          (full page audit)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const AUTH_FILE = path.join(ROOT, '.auth', 'session.json');

const APPS = {
  avadaPlaza: {
    name: 'Avada Plaza',
    handle: process.env.AVADA_PLAZA_HANDLE || process.env.APP_HANDLE || '',
  },
  seo: {
    name: 'SEO',
    handle: process.env.SEO_HANDLE || '',
  },
  blogs: {
    name: 'Blogs',
    handle: process.env.BLOGS_HANDLE || '',
  },
};

const STORE_HANDLE = process.env.STORE_HANDLE || '';
const ADMIN_BASE = `https://admin.shopify.com/store/${STORE_HANDLE}`;

// Page routes per app (add more as needed)
const PAGE_ROUTES = {
  avadaPlaza: {
    home: '',
    'image-manager': 'image-manager',
    'speed-up': 'speed-up',
    notification: 'notification',
    subscription: 'subscription',
    settings: 'settings',
  },
};

// ── Core probe logic ─────────────────────────────────────────────────────────

/**
 * Probe the iframe DOM for elements matching a query.
 * Returns selector-ready data for each match.
 */
async function probeElements(frame, query) {
  return await frame.evaluate((q) => {
    function isVisible(el) {
      if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function getStableClasses(el) {
      if (!el.className || typeof el.className !== 'string') return [];
      return el.className.split(' ').filter(c =>
        c.startsWith('Avada-') || c.startsWith('Polaris-')
      );
    }

    function getDomPath(el, depth = 4) {
      const parts = [];
      let current = el;
      for (let i = 0; i < depth && current && current !== document.body; i++) {
        const tag = current.tagName.toLowerCase();
        const role = current.getAttribute('role');
        const cls = getStableClasses(current);
        const testId = current.getAttribute('data-testid');
        let part = tag;
        if (testId) part += `[data-testid="${testId}"]`;
        else if (role) part += `[role="${role}"]`;
        else if (cls.length) part += `.${cls[0]}`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(' > ');
    }

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Determine query type
    let elements = [];
    if (q.startsWith('.') || q.startsWith('#') || q.startsWith('[')) {
      // CSS selector query
      elements = [...document.querySelectorAll(q)];
    } else if (q === 'button' || q === 'link' || q === 'tab' || q === 'input') {
      // Role/tag type query — list all of that type
      const selectors = {
        button: 'button, [role="button"]',
        link: 'a, [role="link"]',
        tab: '[role="tab"]',
        input: 'input, select, textarea, [role="combobox"], [role="slider"]',
      };
      elements = [...document.querySelectorAll(selectors[q] || q)];
    } else {
      // Text search — find all elements containing the text
      const allEls = document.querySelectorAll('*');
      const lowerQ = q.toLowerCase();
      for (const el of allEls) {
        // Only match leaf-ish elements (not giant containers)
        const text = el.textContent?.trim() || '';
        const directText = [...el.childNodes]
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent?.trim())
          .join(' ')
          .trim();
        const ariaLabel = el.getAttribute('aria-label') || '';

        if (
          (directText && directText.toLowerCase().includes(lowerQ)) ||
          (ariaLabel && ariaLabel.toLowerCase().includes(lowerQ)) ||
          (text.toLowerCase() === lowerQ)
        ) {
          elements.push(el);
        }
      }
    }

    // Build result for each match
    return elements.slice(0, 20).map(el => {
      const text = el.textContent?.trim()?.slice(0, 80) || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const testId = el.getAttribute('data-testid');
      const role = el.getAttribute('role')
        || (el.tagName === 'BUTTON' ? 'button' : null)
        || (el.tagName === 'A' ? 'link' : null);
      const classes = getStableClasses(el);
      const visible = isVisible(el);
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';

      // Build recommended selectors (best → worst)
      // Order matches SKILL.md priority: testId > role > Avada class > label > tLoc
      const selectors = [];
      if (testId) {
        selectors.push({ method: 'getByTestId', code: `frame.getByTestId('${testId}')`, stability: 'best' });
      }
      if (role && (ariaLabel || text)) {
        const name = ariaLabel || text;
        selectors.push({
          method: 'getByRole',
          code: `frame.getByRole('${role}', { name: /${escapeRegex(name)}/i })`,
          stability: 'good',
        });
      }
      const avadaClass = classes.find(c => c.startsWith('Avada-'));
      if (avadaClass) {
        selectors.push({
          method: 'locator (Avada class)',
          code: `frame.locator('.${avadaClass}').first()`,
          stability: 'good — app-specific class',
        });
      }
      // getByLabel — for form inputs (after Avada class per SKILL.md priority)
      if (ariaLabel && el.matches('input, select, textarea, [role="combobox"], [role="slider"]')) {
        selectors.push({
          method: 'getByLabel',
          code: `frame.getByLabel('${ariaLabel}')`,
          stability: 'good',
        });
      }
      const polarisClass = classes.find(c => c.startsWith('Polaris-'));
      if (polarisClass) {
        selectors.push({
          method: 'locator (Polaris class)',
          code: `frame.locator('.${polarisClass}').first()`,
          stability: 'fair — may change on Polaris upgrade',
        });
      }
      // Fallback: text-based (fragile)
      if (text && selectors.length === 0) {
        selectors.push({
          method: 'getByText',
          code: `frame.getByText('${text.slice(0, 40)}')`,
          stability: 'fragile — use tLoc() with .first() instead for i18n support',
        });
      }

      return {
        tag: el.tagName.toLowerCase(),
        role,
        text: text.slice(0, 80),
        ariaLabel,
        testId: testId || null,
        classes,
        visible,
        disabled,
        domPath: getDomPath(el),
        selectors,
        // Extra attrs that help understand state
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaControls: el.getAttribute('aria-controls'),
        outerHtml: el.outerHTML.slice(0, 200),
      };
    });
  }, query);
}

// ── Navigation ───────────────────────────────────────────────────────────────

async function goToApp(page, handle) {
  await page.goto(`${ADMIN_BASE}/apps/${handle}/embed`);
  await page.waitForSelector('iframe[name="app-iframe"]', { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector('iframe[name="app-iframe"]');
      return iframe && iframe.src && iframe.src !== 'about:blank';
    },
    { timeout: 30000 }
  );
  return page.frameLocator('iframe[name="app-iframe"]');
}

async function navigateToPage(page, handle, appKey, pageName) {
  const route = PAGE_ROUTES[appKey]?.[pageName] ?? pageName;
  const url = route
    ? `${ADMIN_BASE}/apps/${handle}/embed/${route}`
    : `${ADMIN_BASE}/apps/${handle}/embed`;

  await page.goto(url);
  await page.waitForSelector('iframe[name="app-iframe"]', { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector('iframe[name="app-iframe"]');
      return iframe && iframe.src && iframe.src !== 'about:blank';
    },
    { timeout: 30000 }
  );

  // Close overlays
  try {
    await page.evaluate(() => document.querySelectorAll('dialog').forEach(d => d.remove()));
  } catch {}
  await page.waitForTimeout(2000); // let animations settle

  return page.frameLocator('iframe[name="app-iframe"]');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] || true;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appKey = args.app || 'avadaPlaza';
  const pageName = args.page || null;
  const query = args.query || null;
  const outFile = args.out || null;

  const app = APPS[appKey];
  if (!app || !app.handle) {
    console.error(`❌ App "${appKey}" không có handle. Kiểm tra .env`);
    process.exit(1);
  }
  if (!STORE_HANDLE) {
    console.error('❌ STORE_HANDLE chưa cấu hình. Chạy: npm run setup');
    process.exit(1);
  }
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('❌ Chưa đăng nhập. Chạy: npm run auth');
    process.exit(1);
  }

  console.log('');
  console.log('🔍 Live DOM Probe');
  console.log('─────────────────────────────────────');
  console.log(`App:   ${app.name} (${app.handle})`);
  console.log(`Page:  ${pageName || 'home'}`);
  console.log(`Query: ${query || '(full page audit)'}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // Navigate
    let frame;
    if (pageName) {
      frame = await navigateToPage(page, app.handle, appKey, pageName);
    } else {
      frame = await goToApp(page, app.handle);
    }
    await frame.locator('body').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Probe
    let results;
    if (query) {
      results = await probeElements(frame, query);
    } else {
      // Full audit: buttons + links + tabs + inputs
      const buttons = await probeElements(frame, 'button');
      const links = await probeElements(frame, 'link');
      const tabs = await probeElements(frame, 'tab');
      const inputs = await probeElements(frame, 'input');
      results = [...buttons, ...links, ...tabs, ...inputs];
    }

    // Output
    const output = {
      app: appKey,
      page: pageName || 'home',
      query: query || '(full audit)',
      url: page.url(),
      probedAt: new Date().toISOString(),
      matchCount: results.length,
      matches: results,
    };

    if (outFile) {
      fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
      console.log(`✅ ${results.length} match(es) → ${outFile}`);
    } else {
      // Pretty print to console
      if (results.length === 0) {
        console.log('⚠️  Không tìm thấy element nào khớp.');
      } else {
        for (const match of results) {
          console.log(`\n${'─'.repeat(60)}`);
          console.log(`  Tag:      ${match.tag}${match.role ? ` [role="${match.role}"]` : ''}`);
          console.log(`  Text:     "${match.text}"`);
          if (match.ariaLabel) console.log(`  Label:    "${match.ariaLabel}"`);
          if (match.testId) console.log(`  TestID:   ${match.testId}`);
          if (match.classes.length) console.log(`  Classes:  ${match.classes.join(', ')}`);
          console.log(`  Visible:  ${match.visible ? 'Yes' : 'No (hidden)'}`);
          if (match.disabled) console.log(`  Disabled: Yes`);
          console.log(`  DOM:      ${match.domPath}`);
          console.log(`  Selectors (best → worst):`);
          for (const s of match.selectors) {
            console.log(`    ${s.stability.padEnd(30)} → ${s.code}`);
          }
        }
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`\n✅ ${results.length} match(es) found.`);
      }

      // Also write to temp file for AI consumption
      const tempPath = path.join(ROOT, 'snapshots', `probe-${appKey}-${pageName || 'home'}.json`);
      const snapshotDir = path.join(ROOT, 'snapshots');
      if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(tempPath, JSON.stringify(output, null, 2));
      console.log(`\n📄 JSON saved: ${path.relative(ROOT, tempPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
