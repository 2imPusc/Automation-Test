#!/usr/bin/env node
/**
 * App Snapshot Tool
 *
 * Mở Shopify app bằng Playwright, chụp screenshot từng trang + extract DOM info,
 * lưu vào snapshots/[app]/ để AI dùng khi generate test.
 *
 * Usage:
 *   npm run snapshot                    → snapshot tất cả apps có handle
 *   npm run snapshot -- --app avadaPlaza  → snapshot 1 app cụ thể
 *   npm run snapshot -- --page settings  → chỉ snapshot 1 trang
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');
const AUTH_FILE = path.join(ROOT, '.auth', 'session.json');

// ── App registry (mirror của helpers/apps.ts) ───────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Extract selector-ready DOM info từ iframe.
 *
 * Thu thập đủ data để AI sinh Playwright selector chính xác:
 * - Headings, buttons, links, inputs (cơ bản)
 * - ARIA roles + names (cho getByRole)
 * - data-testid attributes (cho getByTestId — selector ổn định nhất)
 * - Avada/Polaris custom component classes (cho CSS selectors)
 * - Interactable elements map (tổng hợp mọi element clickable)
 * - Visible text snippets (context)
 */
async function extractDomInfo(frame) {
  return await frame.evaluate(() => {
    const info = {
      headings: [],
      buttons: [],
      links: [],
      inputs: [],
      tabs: [],
      testIds: [],
      roles: [],
      components: [],
      interactables: [],
      texts: [],
    };

    /** Check if element is actually visible on screen */
    function isVisible(el) {
      if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    /** Get Avada/Polaris class names (stable selectors) */
    function getStableClasses(el) {
      if (!el.className || typeof el.className !== 'string') return [];
      return el.className.split(' ').filter(c =>
        c.startsWith('Avada-') || c.startsWith('Polaris-')
      );
    }

    /** Build a concise DOM path showing parent context */
    function getDomPath(el, depth = 3) {
      const parts = [];
      let current = el;
      for (let i = 0; i < depth && current && current !== document.body; i++) {
        const tag = current.tagName.toLowerCase();
        const role = current.getAttribute('role');
        const cls = getStableClasses(current);
        let part = tag;
        if (role) part += `[role="${role}"]`;
        else if (cls.length) part += `.${cls[0]}`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(' > ');
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    document.querySelectorAll('h1,h2,h3,h4').forEach(el => {
      const text = el.textContent?.trim();
      if (text && isVisible(el)) {
        info.headings.push({
          tag: el.tagName.toLowerCase(),
          text,
          testId: el.getAttribute('data-testid') || null,
        });
      }
    });

    // ── Buttons (enhanced) ────────────────────────────────────────────────────
    document.querySelectorAll('button, [role="button"]').forEach(el => {
      const text = el.textContent?.trim();
      const ariaLabel = el.getAttribute('aria-label');
      if (!text && !ariaLabel) return;
      const visible = isVisible(el);
      info.buttons.push({
        text: text || '',
        ariaLabel: ariaLabel || '',
        testId: el.getAttribute('data-testid') || null,
        classes: getStableClasses(el),
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        visible,
        domPath: getDomPath(el),
      });
    });

    // ── Links ─────────────────────────────────────────────────────────────────
    document.querySelectorAll('a, [role="link"]').forEach(el => {
      const text = el.textContent?.trim();
      if (!text) return;
      const isNav = !!el.closest('nav, [role="navigation"]');
      info.links.push({
        text,
        href: el.getAttribute('href') || '',
        isNav,
        testId: el.getAttribute('data-testid') || null,
        visible: isVisible(el),
      });
    });

    // ── Inputs ────────────────────────────────────────────────────────────────
    document.querySelectorAll('input, select, textarea, [role="combobox"], [role="slider"]').forEach(el => {
      const type = el.getAttribute('type') || el.getAttribute('role') || el.tagName.toLowerCase();
      const name = el.getAttribute('name') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const testId = el.getAttribute('data-testid') || null;

      let labelText = '';
      const id = el.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) labelText = label.textContent?.trim() || '';
      }

      info.inputs.push({
        type, name, placeholder, ariaLabel, label: labelText, testId,
        classes: getStableClasses(el),
        visible: isVisible(el),
      });
    });

    // ── Tabs ──────────────────────────────────────────────────────────────────
    document.querySelectorAll('[role="tab"]').forEach(el => {
      const text = el.textContent?.trim();
      if (!text) return;
      info.tabs.push({
        text,
        selected: el.getAttribute('aria-selected') === 'true',
        testId: el.getAttribute('data-testid') || null,
        visible: isVisible(el),
      });
    });

    // ── data-testid elements ──────────────────────────────────────────────────
    document.querySelectorAll('[data-testid]').forEach(el => {
      info.testIds.push({
        testId: el.getAttribute('data-testid'),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || null,
        text: el.textContent?.trim()?.slice(0, 60) || '',
        visible: isVisible(el),
      });
    });

    // ── ARIA role elements (interactive only) ─────────────────────────────────
    const interactiveRoles = [
      'button', 'link', 'tab', 'menuitem', 'option', 'switch',
      'checkbox', 'radio', 'slider', 'spinbutton', 'combobox',
      'listbox', 'dialog', 'alertdialog', 'progressbar', 'alert',
    ];
    document.querySelectorAll('[role]').forEach(el => {
      const role = el.getAttribute('role');
      if (!interactiveRoles.includes(role)) return;
      const name = el.getAttribute('aria-label')
        || el.textContent?.trim()?.slice(0, 80)
        || '';
      if (!name) return;
      info.roles.push({
        role,
        name,
        testId: el.getAttribute('data-testid') || null,
        classes: getStableClasses(el),
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaDisabled: el.getAttribute('aria-disabled'),
        visible: isVisible(el),
      });
    });

    // ── Avada/Polaris custom components ───────────────────────────────────────
    document.querySelectorAll('[class*="Avada-"], [class*="Polaris-"]').forEach(el => {
      const classes = getStableClasses(el);
      if (!classes.length) return;
      // Only capture top-level component wrappers (skip deeply nested internals)
      const parentClasses = getStableClasses(el.parentElement);
      const isTopLevel = !parentClasses.some(c => classes.some(cc => c.startsWith(cc.split('--')[0])));
      if (!isTopLevel) return;

      const role = el.getAttribute('role');
      const text = el.textContent?.trim()?.slice(0, 60) || '';
      const interactable = el.matches(
        'button, a, input, select, [role="button"], [role="tab"], [role="link"], [role="checkbox"]'
      );

      info.components.push({
        classes,
        tag: el.tagName.toLowerCase(),
        role: role || null,
        text,
        interactable,
        visible: isVisible(el),
        ariaExpanded: el.getAttribute('aria-expanded'),
        testId: el.getAttribute('data-testid') || null,
      });
    });

    // ── Interactable elements map (unified) ───────────────────────────────────
    // Combines all clickable/interactive elements into one sorted list.
    // AI uses this to pick the best selector for each action.
    const seen = new Set();
    document.querySelectorAll(
      'button, a, [role="button"], [role="tab"], [role="link"], [role="menuitem"], ' +
      '[role="option"], [role="switch"], [role="checkbox"], [role="radio"], ' +
      'input[type="checkbox"], input[type="radio"], [onclick], [data-testid]'
    ).forEach(el => {
      if (!isVisible(el)) return;
      const text = el.textContent?.trim()?.slice(0, 60) || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const key = `${el.tagName}:${text}:${ariaLabel}`;
      if (seen.has(key)) return;
      seen.add(key);

      const testId = el.getAttribute('data-testid');
      const role = el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : null) || (el.tagName === 'A' ? 'link' : null);
      const classes = getStableClasses(el);

      // Build recommended Playwright selectors (best → worst)
      // Order matches SKILL.md priority: testId > role > Avada class > label > tLoc
      const selectors = [];
      if (testId) {
        selectors.push({ method: 'getByTestId', code: `frame.getByTestId('${testId}')`, stability: 'best' });
      }
      if (role && (ariaLabel || text)) {
        const name = ariaLabel || text;
        selectors.push({
          method: 'getByRole',
          code: `frame.getByRole('${role}', { name: /${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i })`,
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
      // getByLabel for form inputs
      if (el.matches('input, select, textarea, [role="combobox"], [role="slider"]')) {
        const inputLabel = ariaLabel || el.closest('label')?.textContent?.trim() || '';
        if (inputLabel) {
          selectors.push({
            method: 'getByLabel',
            code: `frame.getByLabel('${inputLabel.slice(0, 50)}')`,
            stability: 'good',
          });
        }
      }
      // Fallback: text-based (fragile — warn AI)
      if (text && selectors.length === 0) {
        selectors.push({
          method: 'getByText',
          code: `frame.getByText('${text.slice(0, 40)}')`,
          stability: 'fragile — use tLoc() with .first() instead for i18n support',
        });
      }

      info.interactables.push({
        tag: el.tagName.toLowerCase(),
        role,
        text,
        ariaLabel,
        testId: testId || null,
        classes,
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        selectors,
        domPath: getDomPath(el),
      });
    });

    // ── Visible text snippets ─────────────────────────────────────────────────
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
          const text = node.textContent?.trim();
          if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const texts = new Set();
    let node;
    while ((node = walker.nextNode()) && texts.size < 50) {
      const text = node.textContent?.trim();
      if (text && text.length > 2 && text.length < 100) texts.add(text);
    }
    info.texts = [...texts];

    return info;
  });
}

/**
 * Chụp snapshot 1 trang của app.
 * @param {import('playwright').Page} page
 * @param {string} appKey
 * @param {string} pageName - tên trang (vd: 'home', 'settings')
 * @param {Function} navigateFn - async function để navigate đến trang đó
 */
async function snapshotPage(page, appKey, pageName, navigateFn, outDir) {
  console.log(`  📸 Chụp: ${pageName}...`);

  try {
    const frame = await navigateFn(page);

    // Chờ iframe load
    await frame.locator('body').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2000); // cho animations settle

    // Chụp toàn trang
    const screenshotPath = path.join(outDir, `${slugify(pageName)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Extract DOM info
    let domInfo = {};
    try {
      domInfo = await extractDomInfo(frame);
    } catch (e) {
      // iframe cross-origin có thể block — bỏ qua
      domInfo = { error: 'Cannot extract DOM (cross-origin)' };
    }

    // Lưu DOM info dạng JSON
    const jsonPath = path.join(outDir, `${slugify(pageName)}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({
      app: appKey,
      page: pageName,
      url: page.url(),
      capturedAt: new Date().toISOString(),
      dom: domInfo,
    }, null, 2));

    console.log(`    ✅ Saved: ${path.relative(ROOT, screenshotPath)}`);
    return { screenshot: screenshotPath, json: jsonPath };
  } catch (err) {
    console.log(`    ⚠️  Skip (${err.message.split('\n')[0]})`);
    return null;
  }
}

/**
 * Navigate đến app và trả về frame.
 */
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

/**
 * Hỏi tester muốn chụp trang nào ngoài trang chính.
 */
async function askAdditionalPages() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('');
    console.log('💡 Bạn có thể thêm trang cần chụp (optional):');
    console.log('   Nhập tên trang, Enter để bỏ qua.');
    console.log('   Ví dụ: "Settings", "Dashboard", "Image Manager"');
    console.log('');
    rl.question('Tên trang cần chụp thêm (Enter để bỏ qua): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const appFilter = args.find((_, i) => args[i - 1] === '--app');

  // Validate
  if (!STORE_HANDLE) {
    console.error('❌ STORE_HANDLE chưa được cấu hình. Chạy: npm run setup');
    process.exit(1);
  }

  if (!fs.existsSync(AUTH_FILE)) {
    console.error('❌ Chưa đăng nhập. Chạy: npm run auth');
    process.exit(1);
  }

  // Filter apps
  const appsToSnapshot = Object.entries(APPS).filter(([key, app]) => {
    if (!app.handle) return false;
    if (appFilter) return key === appFilter;
    return true;
  });

  if (appsToSnapshot.length === 0) {
    console.error('❌ Không có app nào có handle. Kiểm tra file .env');
    process.exit(1);
  }

  console.log('');
  console.log('📸 App Snapshot Tool');
  console.log('─────────────────────────────────────');
  console.log(`Apps sẽ chụp: ${appsToSnapshot.map(([k, a]) => a.name).join(', ')}`);

  // Hỏi trang thêm
  const extraPage = await askAdditionalPages();

  // Launch browser với saved session
  const browser = await chromium.launch({ headless: false }); // headed để tester thấy
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Đóng Shopify Sidekick nếu có
  page.on('load', async () => {
    try {
      const sidekick = page.getByRole('button', { name: 'Close Sidekick' });
      if (await sidekick.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sidekick.click();
      }
    } catch {}
  });

  const results = [];

  for (const [appKey, app] of appsToSnapshot) {
    console.log('');
    console.log(`🔍 ${app.name} (${app.handle})`);

    const outDir = path.join(SNAPSHOTS_DIR, appKey);
    ensureDir(outDir);

    // Chụp trang chính (home)
    const homeResult = await snapshotPage(page, appKey, 'home', async (p) => {
      return goToApp(p, app.handle);
    }, outDir);
    if (homeResult) results.push({ app: appKey, page: 'home', ...homeResult });

    // Chụp trang thêm nếu tester nhập
    if (extraPage) {
      const extraResult = await snapshotPage(page, appKey, extraPage, async (p) => {
        const frame = await goToApp(p, app.handle);
        // Thử click nav link tương ứng
        try {
          await p.getByRole('link', { name: extraPage }).first().click();
          await p.waitForTimeout(2000);
        } catch {
          console.log(`    ⚠️  Không tìm thấy nav link "${extraPage}", chụp trang hiện tại`);
        }
        return frame;
      }, outDir);
      if (extraResult) results.push({ app: appKey, page: extraPage, ...extraResult });
    }
  }

  await browser.close();

  // Tạo index file
  const indexPath = path.join(SNAPSHOTS_DIR, 'index.json');
  const existing = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf-8')) : { snapshots: [] };

  // Merge (giữ cũ, update mới)
  for (const r of results) {
    const idx = existing.snapshots.findIndex(s => s.app === r.app && s.page === r.page);
    const entry = {
      app: r.app,
      page: r.page,
      screenshot: path.relative(ROOT, r.screenshot),
      json: path.relative(ROOT, r.json),
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) existing.snapshots[idx] = entry;
    else existing.snapshots.push(entry);
  }

  fs.writeFileSync(indexPath, JSON.stringify(existing, null, 2));

  console.log('');
  console.log('─────────────────────────────────────');
  console.log(`✅ Xong! ${results.length} snapshot(s) đã lưu vào snapshots/`);
  console.log('');
  console.log('💡 Giờ chạy test:generate sẽ dùng snapshots này để viết selector chính xác hơn:');
  console.log('   npm run test:generate');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
