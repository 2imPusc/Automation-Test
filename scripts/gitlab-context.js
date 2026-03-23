#!/usr/bin/env node
/**
 * GitLab Context Extractor
 *
 * Khi không có source code app trên máy, dùng GitLab MR diff để extract context:
 *   - data-testid values
 *   - Button/label text từ JSX
 *   - Route paths
 *   - Toast/notification messages từ locale files
 *
 * Export:
 *   extractFromGitLabDiff(appKey, mrUrl, contextDir)
 *     → string (path của file markdown đã lưu)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_URL   = process.env.GITLAB_URL || 'https://gitlab.com';

// ── Parse MR URL ──────────────────────────────────────────────────────────────

/**
 * Parse MR URL thành { projectPath, mrIid }
 * Input:  https://gitlab.com/avada/avada-image-optimizer/-/merge_requests/102
 * Output: { projectPath: 'avada/avada-image-optimizer', mrIid: '102' }
 */
function parseMrUrl(mrUrl) {
  const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!match) throw new Error(`Không parse được MR URL: ${mrUrl}`);
  return { projectPath: match[1], mrIid: match[2] };
}

// ── GitLab API ─────────────────────────────────────────────────────────────────

function gitlabGet(apiPath) {
  if (!GITLAB_TOKEN) throw new Error('GITLAB_TOKEN chưa set trong .env');
  const url = `${GITLAB_URL}/api/v4${apiPath}`;
  const res = execSync(
    `curl -s "${url}" -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}"`,
    { stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }
  ).toString();
  return JSON.parse(res);
}

/**
 * Lấy danh sách diff files từ MR.
 * Dùng pagination để lấy tất cả (mặc định GitLab trả 20 per page).
 */
function getMrDiffs(projectPath, mrIid) {
  const encoded = encodeURIComponent(projectPath);
  const diffs = [];
  let page = 1;

  while (true) {
    const data = gitlabGet(
      `/projects/${encoded}/merge_requests/${mrIid}/diffs?per_page=50&page=${page}`
    );

    if (!Array.isArray(data) || data.length === 0) break;
    diffs.push(...data);
    if (data.length < 50) break;
    page++;
  }

  return diffs;
}

// ── Filter files ─────────────────────────────────────────────────────────────

const EXCLUDED_PATHS = [/node_modules/, /\/dist\//, /\/build\//, /\/\.next\//, /\/coverage\//];
const INCLUDED_EXTS  = ['.jsx', '.tsx', '.ts', '.js'];
const LOCALE_EXTS    = ['.json'];
const LOCALE_PATHS   = [/locale/, /i18n/, /lang/, /translations/];

function isRelevantFile(filePath) {
  if (EXCLUDED_PATHS.some(re => re.test(filePath))) return false;
  const ext = path.extname(filePath);
  return INCLUDED_EXTS.includes(ext);
}

function isLocaleFile(filePath) {
  if (EXCLUDED_PATHS.some(re => re.test(filePath))) return false;
  const ext = path.extname(filePath);
  if (!LOCALE_EXTS.includes(ext)) return false;
  return LOCALE_PATHS.some(re => re.test(filePath));
}

// ── Extractor helpers ─────────────────────────────────────────────────────────

/** Lấy các dòng added (+) và context từ diff patch */
function getAddedLines(patch) {
  if (!patch) return [];
  return patch.split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1));
}

/** Extract data-testid="..." values */
function extractTestIds(lines) {
  const ids = new Set();
  for (const line of lines) {
    const matches = line.matchAll(/data-testid=["']([^"']+)["']/g);
    for (const m of matches) ids.add(m[1]);
    // data-testid={...} dynamic — skip
  }
  return [...ids];
}

/** Extract button/label text từ JSX */
function extractButtonTexts(lines) {
  const texts = new Set();
  for (const line of lines) {
    // <Button>Text</Button>  hoặc <Button label="Text">
    const labelAttr = line.matchAll(/(?:label|title|text|children)=["']([^"']{2,60})["']/g);
    for (const m of labelAttr) {
      const t = m[1].trim();
      if (t && !t.includes('{') && !t.startsWith('http')) texts.add(t);
    }

    // JSX text content: >Some Text<
    const jsxText = line.matchAll(/>([A-Z][^<{]{2,60})</g);
    for (const m of jsxText) {
      const t = m[1].trim();
      if (t && !t.includes('{') && !t.startsWith('//')) texts.add(t);
    }

    // i18n keys: t('key.name') or i18n.t('key')
    const i18nKeys = line.matchAll(/\bt\(["']([^"']+)["']\)/g);
    for (const m of i18nKeys) texts.add(`[i18n] ${m[1]}`);
  }
  return [...texts];
}

/** Extract route paths */
function extractRoutes(lines) {
  const routes = new Set();
  for (const line of lines) {
    // path="..." trong Route component
    const pathAttr = line.matchAll(/(?:path|to|href)=["'](\/?[a-zA-Z0-9_/-]{2,80})["']/g);
    for (const m of pathAttr) {
      const r = m[1];
      if (r.startsWith('/') || r.startsWith('./') || r.startsWith('../')) routes.add(r);
    }

    // navigate('/route') hoặc router.push('/route')
    const navCalls = line.matchAll(/(?:navigate|push|replace|redirect)\(['"](\/?[a-zA-Z0-9_/-]{2,80})['"]\)/g);
    for (const m of navCalls) routes.add(m[1]);
  }
  return [...routes];
}

/** Extract toast/notification messages */
function extractToastMessages(lines) {
  const msgs = new Set();
  for (const line of lines) {
    // toast('message') hoặc showToast("message") hoặc notification.success("msg")
    const toastCalls = line.matchAll(
      /(?:toast|showToast|notification|notify|message|alert|snackbar)\s*(?:\.\w+)?\s*\(\s*["']([^"']{3,120})["']/gi
    );
    for (const m of toastCalls) msgs.add(m[1]);

    // { message: "..." } trong toast objects
    const msgProp = line.matchAll(/message:\s*["']([^"']{3,120})["']/g);
    for (const m of msgProp) msgs.add(m[1]);
  }
  return [...msgs];
}

/** Extract toast messages từ locale JSON file */
function extractLocaleToasts(patch) {
  if (!patch) return [];
  const addedLines = getAddedLines(patch);
  const combined = addedLines.join('\n');
  const msgs = new Set();

  // JSON keys liên quan đến toast/success/error
  const toastKeys = combined.matchAll(/"(?:toast|success|error|warning|saved|deleted|updated|created|failed|message|notification)[^"]*":\s*"([^"]{3,120})"/gi);
  for (const m of toastKeys) msgs.add(m[1]);

  return [...msgs];
}

// ── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extract context từ GitLab MR diff và lưu thành markdown.
 *
 * @param {string} appKey     - key trong registry (e.g. 'avadaPlaza')
 * @param {string} mrUrl      - GitLab MR URL
 * @param {string} contextDir - thư mục để lưu file context
 * @returns {string} path của file markdown đã lưu
 */
async function extractFromGitLabDiff(appKey, mrUrl, contextDir) {
  const { projectPath, mrIid } = parseMrUrl(mrUrl);

  console.log(`  📡 Fetching MR diff từ GitLab: ${projectPath}!${mrIid}`);

  const diffs = getMrDiffs(projectPath, mrIid);
  console.log(`  📁 ${diffs.length} files trong MR diff`);

  const relevantDiffs = diffs.filter(d => isRelevantFile(d.new_path || d.old_path));
  const localeDiffs   = diffs.filter(d => isLocaleFile(d.new_path || d.old_path));

  console.log(`  🔍 ${relevantDiffs.length} relevant files (.jsx/.tsx/.ts)`);

  // Collect across all relevant files
  const allTestIds  = [];
  const allButtons  = [];
  const allRoutes   = [];
  const allToasts   = [];
  const changedFiles = [];

  for (const diff of relevantDiffs) {
    const filePath = diff.new_path || diff.old_path;
    const addedLines = getAddedLines(diff.diff);

    const testIds = extractTestIds(addedLines);
    const buttons = extractButtonTexts(addedLines);
    const routes  = extractRoutes(addedLines);
    const toasts  = extractToastMessages(addedLines);

    if (testIds.length || buttons.length || routes.length || toasts.length) {
      changedFiles.push({ filePath, testIds, buttons, routes, toasts });
    }

    allTestIds.push(...testIds);
    allButtons.push(...buttons);
    allRoutes.push(...routes);
    allToasts.push(...toasts);
  }

  // Extract từ locale files
  for (const diff of localeDiffs) {
    const localeToasts = extractLocaleToasts(diff.diff);
    allToasts.push(...localeToasts);
  }

  // Dedup
  const dedupTestIds = [...new Set(allTestIds)];
  const dedupButtons = [...new Set(allButtons)];
  const dedupRoutes  = [...new Set(allRoutes)];
  const dedupToasts  = [...new Set(allToasts)];

  // ── Build markdown ────────────────────────────────────────────────────────

  const lines = [];
  lines.push(`---`);
  lines.push(`source: gitlab-mr-diff`);
  lines.push(`mr: ${mrUrl}`);
  lines.push(`project: ${projectPath}`);
  lines.push(`mr_iid: ${mrIid}`);
  lines.push(`extracted_at: ${new Date().toISOString()}`);
  lines.push(`---`);
  lines.push('');
  lines.push(`# Context từ MR Diff — ${projectPath}!${mrIid}`);
  lines.push('');
  lines.push('> ⚠️ **Partial context** — extract từ MR diff, không phải full source scan.');
  lines.push('> Chỉ có thay đổi trong MR này, không có toàn bộ codebase.');
  lines.push('');

  // Test IDs
  lines.push('## Test IDs (data-testid)');
  lines.push('');
  if (dedupTestIds.length) {
    dedupTestIds.forEach(id => lines.push(`- \`${id}\``));
  } else {
    lines.push('_Không tìm thấy data-testid trong MR diff._');
  }
  lines.push('');

  // Buttons / Labels
  lines.push('## Button / Label Text');
  lines.push('');
  if (dedupButtons.length) {
    dedupButtons.forEach(t => lines.push(`- "${t}"`));
  } else {
    lines.push('_Không tìm thấy button text trong MR diff._');
  }
  lines.push('');

  // Routes
  lines.push('## Route Paths');
  lines.push('');
  if (dedupRoutes.length) {
    dedupRoutes.forEach(r => lines.push(`- \`${r}\``));
  } else {
    lines.push('_Không tìm thấy route paths trong MR diff._');
  }
  lines.push('');

  // Toast messages
  lines.push('## Toast / Notification Messages');
  lines.push('');
  if (dedupToasts.length) {
    dedupToasts.forEach(m => lines.push(`- "${m}"`));
  } else {
    lines.push('_Không tìm thấy toast messages trong MR diff._');
  }
  lines.push('');

  // Changed files breakdown
  lines.push('## Files thay đổi trong MR');
  lines.push('');
  for (const { filePath, testIds, buttons, routes, toasts } of changedFiles) {
    lines.push(`### \`${filePath}\``);
    if (testIds.length)  lines.push(`- Test IDs: ${testIds.map(x => `\`${x}\``).join(', ')}`);
    if (buttons.length)  lines.push(`- Buttons: ${buttons.slice(0, 5).map(x => `"${x}"`).join(', ')}`);
    if (routes.length)   lines.push(`- Routes: ${routes.map(x => `\`${x}\``).join(', ')}`);
    if (toasts.length)   lines.push(`- Toasts: ${toasts.slice(0, 3).map(x => `"${x}"`).join(', ')}`);
    lines.push('');
  }

  // ── Save file ─────────────────────────────────────────────────────────────

  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  const outFile = path.join(contextDir, `${appKey}-gitlab-diff.md`);
  fs.writeFileSync(outFile, lines.join('\n'));

  console.log(`  ✅ Saved: ${outFile}`);
  console.log(`     Test IDs: ${dedupTestIds.length}, Buttons: ${dedupButtons.length}, Routes: ${dedupRoutes.length}, Toasts: ${dedupToasts.length}`);

  return outFile;
}

module.exports = { extractFromGitLabDiff, parseMrUrl };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const mrUrl = args.find((_, i) => args[i - 1] === '--mr') || args[0];
  const appKey = args.find((_, i) => args[i - 1] === '--app') || 'unknown';
  const outDir = args.find((_, i) => args[i - 1] === '--out')
    || path.join(__dirname, '..', '.context', appKey);

  if (!mrUrl || !mrUrl.includes('merge_requests')) {
    console.error('Usage: node scripts/gitlab-context.js --mr <MR_URL> [--app <appKey>] [--out <dir>]');
    process.exit(1);
  }

  extractFromGitLabDiff(appKey, mrUrl, outDir)
    .then(file => console.log(`\n✅ Context saved: ${file}`))
    .catch(err => { console.error('❌', err.message); process.exit(1); });
}
