#!/usr/bin/env node
/**
 * add-app — Thêm app Shopify mới vào shopify-autotest.
 *
 * Tự động:
 *   1. Hỏi thông tin app (key, name, handle, repo, product spec path)
 *   2. Cập nhật apps-registry.json
 *   3. Cập nhật helpers/apps.ts
 *   4. Cập nhật scripts/pick.js
 *   5. Cập nhật scripts/product-spec-fetcher.js
 *   6. Cập nhật pipeline-helpers.ts (resolveAppKey + appKeyToFolder)
 *   7. Tạo tests/[appFolder]/ + placeholder spec
 *   8. Tạo app-context/[appFolder]/_overview.md template
 *   9. Thêm keys vào .env + .env.example
 *  10. Hướng dẫn bước tiếp theo
 *
 * Usage: npm run add-app
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

const ask = (rl, q, def) => new Promise(resolve => {
  const prompt = def ? `${q} [${def}]: ` : `${q}: `;
  rl.question(prompt, ans => resolve(ans.trim() || def || ''));
});

const askYN = (rl, q, def = 'y') => new Promise(resolve => {
  rl.question(`${q} [${def === 'y' ? 'Y/n' : 'y/N'}]: `, ans => {
    const v = ans.trim().toLowerCase() || def;
    resolve(v === 'y');
  });
});

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function patchFile(file, patches) {
  let content = fs.readFileSync(file, 'utf-8');
  for (const { from, to, required = true } of patches) {
    if (typeof from === 'string') {
      if (!content.includes(from)) {
        if (required) throw new Error(`Patch anchor not found in ${path.basename(file)}:\n  "${from}"`);
        continue;
      }
      content = content.replace(from, to);
    } else {
      // RegExp
      content = content.replace(from, to);
    }
  }
  fs.writeFileSync(file, content);
}

// ── Step runners ─────────────────────────────────────────────────────────────

function step1_registry(info) {
  const file = path.join(ROOT, 'skills/shopify-test-gen/references/apps-registry.json');
  const reg  = readJSON(file);

  if (reg[info.appKey]) {
    console.log(`  ⚠️  "${info.appKey}" đã tồn tại trong apps-registry.json — bỏ qua`);
    return;
  }

  reg[info.appKey] = {
    name:        info.appName,
    repoPath:    `~/${info.repoFolder}`,
    srcPath:     info.srcPath,
    localePath:  `${info.srcPath}/locale/translations/origin.json`,
    testDir:     `tests/${info.appFolder}`,
    contextDir:  `skills/shopify-test-gen/references/app-context/${info.appFolder}`,
  };

  writeJSON(file, reg);
  console.log(`  ✅ apps-registry.json — thêm "${info.appKey}"`);
}

function step2_appsTs(info) {
  const file = path.join(ROOT, 'helpers/apps.ts');
  const content = fs.readFileSync(file, 'utf-8');

  if (content.includes(`${info.appKey}:`)) {
    console.log(`  ⚠️  helpers/apps.ts đã có "${info.appKey}" — bỏ qua`);
    return;
  }

  const handleEnvKey = info.handleEnvKey; // e.g. NEW_APP_HANDLE

  patchFile(file, [
    // 1. Thêm key vào AppRegistry interface
    {
      from: '  blogs: AppConfig;\n}',
      to:   `  blogs: AppConfig;\n  ${info.appKey}: AppConfig;\n}`,
    },
    // 2. Thêm entry vào APPS object
    {
      from: '  blogs: {\n    handle: handle(\'BLOGS_HANDLE\'),',
      to:   `  blogs: {\n    handle: handle('BLOGS_HANDLE'),`,
    },
  ]);

  // Thêm app entry trước dấu }; cuối
  patchFile(file, [
    {
      from: '};\n',
      to:   `  ${info.appKey}: {\n    handle: handle('${handleEnvKey}'),\n    name: '${info.appName}',\n    testDir: 'tests/${info.appFolder}',\n  },\n};\n`,
    },
  ]);

  console.log(`  ✅ helpers/apps.ts — thêm "${info.appKey}"`);
}

function step3_pickJs(info) {
  const file = path.join(ROOT, 'scripts/pick.js');

  if (fs.readFileSync(file, 'utf-8').includes(`tests/${info.appFolder}/`)) {
    console.log(`  ⚠️  scripts/pick.js đã có "${info.appFolder}" — bỏ qua`);
    return;
  }

  patchFile(file, [
    {
      from: `  { label: 'Smoke tests only (fast ⚡)',`,
      to:   `  { label: '${info.appName} only',                 cmd: ['playwright', 'test', '--project=chromium', 'tests/${info.appFolder}/'] },\n  { label: 'Smoke tests only (fast ⚡)',`,
    },
  ]);

  console.log(`  ✅ scripts/pick.js — thêm menu option "${info.appName} only"`);
}

function step4_specFetcher(info) {
  const file = path.join(ROOT, 'scripts/product-spec-fetcher.js');
  const content = fs.readFileSync(file, 'utf-8');

  if (content.includes(`${info.appKey}:`)) {
    console.log(`  ⚠️  product-spec-fetcher.js đã có "${info.appKey}" — bỏ qua`);
    return;
  }

  const specPath = info.productSpecPath || 'null';
  const specValue = specPath === 'null' ? 'null' : `'${specPath}'`;

  // Thêm vào APP_SPEC_PATHS
  patchFile(file, [
    {
      from: `  blogs:      'seo-on-blog/features/Feature specification document',\n};`,
      to:   `  blogs:      'seo-on-blog/features/Feature specification document',\n  ${info.appKey}: ${specValue},\n};`,
    },
  ]);

  // Thêm fallback handler trong matchSpecPath
  if (specPath !== 'null') {
    patchFile(file, [
      {
        from: `  if (appKey === 'blogs') {`,
        to:   `  if (appKey === '${info.appKey}') {\n    // TODO: thêm FEATURE_MAP cho ${info.appKey} nếu có nhiều features\n    try {\n      const entries = await gitlabListTree(basePath, PRODUCT_DOCS_REF);\n      const mdFiles = entries.filter(e => e.type === 'blob' && e.name.endsWith('.md'));\n      const keywords = lower.split('-').filter(w => w.length > 2);\n      let best = null, bestScore = 0;\n      for (const f of mdFiles) {\n        const score = keywords.filter(k => f.name.toLowerCase().includes(k)).length;\n        if (score > bestScore) { bestScore = score; best = f.name; }\n      }\n      if (best) return \`\${basePath}/\${best}\`;\n    } catch { /* ignore */ }\n    return null;\n  }\n\n  if (appKey === 'blogs') {`,
      },
    ]);
  }

  console.log(`  ✅ product-spec-fetcher.js — thêm "${info.appKey}" (spec: ${specPath === 'null' ? 'chưa có' : specPath})`);
}

function step5_pipelineHelpers(info) {
  const file = path.join(ROOT, 'web/src/app/api/smart/_shared/pipeline-helpers.ts');
  const content = fs.readFileSync(file, 'utf-8');

  if (content.includes(`"${info.appKey}"`)) {
    console.log(`  ⚠️  pipeline-helpers.ts đã có "${info.appKey}" — bỏ qua`);
    return;
  }

  // resolveAppKey: thêm keyword detection
  const keywords = info.appNameKeywords.split(',').map(k => k.trim().toLowerCase());
  const checks = keywords.map(k => `lower.includes("${k}")`).join(' || ');
  patchFile(file, [
    {
      from: `  if (lower.includes("blog")) return "blogs";`,
      to:   `  if (lower.includes("blog")) return "blogs";\n  if (${checks}) return "${info.appKey}";`,
    },
  ]);

  // appKeyToFolder: thêm mapping
  patchFile(file, [
    {
      from: `  if (appKey === "avadaPlaza") return "avada-plaza";`,
      to:   `  if (appKey === "avadaPlaza") return "avada-plaza";\n  if (appKey === "${info.appKey}") return "${info.appFolder}";`,
    },
  ]);

  console.log(`  ✅ pipeline-helpers.ts — resolveAppKey + appKeyToFolder`);
}

function step6_testDir(info) {
  const testDir = path.join(ROOT, 'tests', info.appFolder);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`  ✅ tests/${info.appFolder}/ — thư mục tạo xong`);
  } else {
    console.log(`  ⚠️  tests/${info.appFolder}/ đã tồn tại — bỏ qua`);
    return;
  }

  // Tạo placeholder smoke test
  const specFile = path.join(testDir, 'basic.spec.ts');
  const specContent = `/**
 * ${info.appName} — Basic smoke tests
 * Auto-generated by add-app script. Customize as needed.
 */
import { test, expect } from '@playwright/test';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';

test.describe('${info.appName} — Basic', () => {
  test('app loads without error @smoke', async ({ page }) => {
    const frame = await goToApp(page, APPS.${info.appKey}.handle);
    // Assert app iframe loaded
    await expect(frame.locator('body')).toBeVisible({ timeout: 20000 });
    console.log('✅ ${info.appName} app loaded');
  });
});
`;
  fs.writeFileSync(specFile, specContent);
  console.log(`  ✅ tests/${info.appFolder}/basic.spec.ts — smoke test placeholder`);
}

function step7_contextDir(info) {
  const contextDir = path.join(ROOT, 'skills/shopify-test-gen/references/app-context', info.appFolder);
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  const overviewFile = path.join(contextDir, '_overview.md');
  if (fs.existsSync(overviewFile)) {
    console.log(`  ⚠️  app-context/${info.appFolder}/_overview.md đã tồn tại — bỏ qua`);
    return;
  }

  const overviewContent = `---
app: ${info.appKey}
branch: master
commit: (auto-updated by context-sync)
extracted_at: ${new Date().toISOString().slice(0, 10)}
src: ~/${info.repoFolder}/${info.srcPath}
---

# ${info.appName} — Overview

> TODO: Điền thông tin pages và feature files cho app này.
> Tham khảo avada-plaza/_overview.md để biết format.

## App Entry

- **APPS key:** \`${info.appKey}\`
- **Handle:** \`APPS.${info.appKey}.handle\` (từ \`helpers/apps.ts\`)
- **Iframe selector:** \`iframe[name="app-iframe"]\`
- **App content:** inside iframe → \`frame.locator(...)\`

## Pages & Feature Files

| Nav label | URL path | Feature file | Product spec |
|---|---|---|---|
| TODO | / | TODO | TODO |

## Common Selectors

\`\`\`typescript
// Toast notification
frame.locator('[role="alert"]').first()

// Loading skeleton
frame.locator('[class*="Skeleton" i]').first()

// Modal (exclude Sidekick)
page.locator('[role="dialog"]:not(#sidekick)').first()
\`\`\`

## Scanned Context

Chạy \`npm run scan-source -- --app ${info.appKey}\` để auto-scan từ source code.
`;

  fs.writeFileSync(overviewFile, overviewContent);
  console.log(`  ✅ app-context/${info.appFolder}/_overview.md — template tạo xong`);
}

function step8_envFiles(info) {
  const envFile    = path.join(ROOT, '.env');
  const envExample = path.join(ROOT, '.env.example');
  const envKey     = info.handleEnvKey;

  // .env
  if (fs.existsSync(envFile)) {
    let content = fs.readFileSync(envFile, 'utf-8');
    if (!content.includes(envKey)) {
      content += `\n# ${info.appName}\n${envKey}=\n`;
      fs.writeFileSync(envFile, content);
      console.log(`  ✅ .env — thêm ${envKey}`);
    } else {
      console.log(`  ⚠️  .env đã có ${envKey} — bỏ qua`);
    }
  }

  // .env.example
  if (fs.existsSync(envExample)) {
    let content = fs.readFileSync(envExample, 'utf-8');
    if (!content.includes(envKey)) {
      content += `\n# ${info.appName}\n${envKey}=your-${info.appFolder}-handle\n`;
      fs.writeFileSync(envExample, content);
      console.log(`  ✅ .env.example — thêm ${envKey}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🆕 Add New App — Shopify Autotest');
  console.log('══════════════════════════════════════');
  console.log('Script này sẽ cập nhật tất cả config files để thêm app mới.\n');

  // Đọc apps hiện tại để tránh trùng
  const reg = readJSON(path.join(ROOT, 'skills/shopify-test-gen/references/apps-registry.json'));
  const existingKeys = Object.keys(reg).filter(k => k !== '_comment');
  console.log(`Apps hiện tại: ${existingKeys.join(', ')}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Gather info ──────────────────────────────────────────────────────────

  // App key
  let appKey = '';
  while (!appKey) {
    appKey = await ask(rl, '1. App key (camelCase, e.g. "googleFeed")');
    if (!appKey.match(/^[a-z][a-zA-Z0-9]+$/)) {
      console.log('   ⚠️  Phải là camelCase, bắt đầu bằng chữ thường');
      appKey = '';
    } else if (existingKeys.includes(appKey)) {
      console.log(`   ⚠️  "${appKey}" đã tồn tại`);
      appKey = '';
    }
  }

  // App name
  const appName = await ask(rl, '2. App name (human readable, e.g. "Google Product Feed")',
    appKey.replace(/([A-Z])/g, ' $1').trim()
  );

  // App folder (kebab-case)
  const defaultFolder = appKey.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  const appFolder = await ask(rl, `3. Test folder (kebab-case, e.g. "google-feed")`, defaultFolder);

  // Env key
  const defaultEnvKey = appFolder.toUpperCase().replace(/-/g, '_') + '_HANDLE';
  const handleEnvKey = await ask(rl, `4. .env handle key (e.g. "GOOGLE_FEED_HANDLE")`, defaultEnvKey);

  // Repo folder
  const defaultRepo = appFolder;
  const repoFolder = await ask(rl, `5. Local repo folder (~/[folder], e.g. "google-product-feed")`, defaultRepo);

  // Src path
  const srcPath = await ask(rl, '6. Source code path bên trong repo (e.g. "packages/assets/src")', 'src');

  // Keyword detection
  console.log(`\n7. Keyword để detect app từ Notion task title`);
  console.log(`   (Pipeline dùng để tự nhận ra đây là app nào khi parse task)`);
  const defaultKeyword = appFolder.split('-')[0];
  const appNameKeywords = await ask(rl, `   Keywords (comma-separated, e.g. "feed,product-feed")`, defaultKeyword);

  // Product spec path
  console.log('\n8. GitLab product spec path (để lấy button/toast text)');
  console.log('   Ví dụ: "google-product-feed/features/Feature specification document"');
  console.log('   Nhấn Enter để bỏ qua (có thể thêm sau)');
  const productSpecPath = await ask(rl, '   Spec path', '');

  rl.close();

  // ── Summary ──────────────────────────────────────────────────────────────

  const info = { appKey, appName, appFolder, handleEnvKey, repoFolder, srcPath, appNameKeywords, productSpecPath };

  console.log('\n══════════════════════════════════════');
  console.log('📋 Tóm tắt:');
  console.log(`   App key:     ${appKey}`);
  console.log(`   App name:    ${appName}`);
  console.log(`   Test folder: tests/${appFolder}/`);
  console.log(`   Env key:     ${handleEnvKey}`);
  console.log(`   Repo:        ~/${repoFolder}/${srcPath}`);
  console.log(`   Keywords:    ${appNameKeywords}`);
  console.log(`   Spec path:   ${productSpecPath || '(chưa có)'}`);
  console.log('══════════════════════════════════════\n');

  // Confirm
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmed = await askYN(rl2, 'Tiếp tục?');
  rl2.close();

  if (!confirmed) {
    console.log('\n❌ Đã hủy.\n');
    process.exit(0);
  }

  // ── Run steps ──────────────────────────────────────────────────────────

  console.log('\n🔧 Đang cập nhật files...\n');

  try {
    step1_registry(info);
    step2_appsTs(info);
    step3_pickJs(info);
    step4_specFetcher(info);
    step5_pipelineHelpers(info);
    step6_testDir(info);
    step7_contextDir(info);
    step8_envFiles(info);
  } catch (err) {
    console.error(`\n❌ Lỗi: ${err.message}`);
    console.error('   Vui lòng kiểm tra và sửa thủ công nếu cần.\n');
    process.exit(1);
  }

  // ── Next steps ─────────────────────────────────────────────────────────

  console.log(`
══════════════════════════════════════
✅ Xong! App "${appName}" đã được thêm.

📋 Việc cần làm tiếp:

1. Điền handle vào .env:
   ${handleEnvKey}=your-actual-handle

2. Clone repo (nếu chưa có):
   git clone <repo-url> ~/${repoFolder}

3. Scan source code để AI có context:
   npm run scan-source -- --app ${appKey}

4. Update overview file:
   skills/shopify-test-gen/references/app-context/${appFolder}/_overview.md
   → Điền pages, routes, feature files thật

5. Đăng nhập Shopify (nếu dùng store khác):
   npm run auth

6. Chạy smoke test:
   npx playwright test tests/${appFolder}/basic.spec.ts --headed
══════════════════════════════════════
`);
}

// Export step functions cho testing
module.exports = { step1_registry, step2_appsTs, step3_pickJs, step4_specFetcher, step5_pipelineHelpers, step6_testDir, step7_contextDir, step8_envFiles };

if (require.main === module) {
  main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
