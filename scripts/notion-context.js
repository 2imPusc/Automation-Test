#!/usr/bin/env node
/**
 * Notion Context Loader
 *
 * Đọc thông tin từ Notion task page để inject vào AI generator:
 *   - App + Stage → xác định staging handle
 *   - MR link → branch name (qua GitLab API)
 *   - Bug list (to_do blocks) → mô tả test case
 *   - Comments → context staging/deploy từ team
 *
 * Usage (standalone):
 *   node scripts/notion-context.js --page https://www.notion.so/...
 *
 * Export:
 *   loadNotionContext(pageUrl) → { appKey, appName, stagingHandle, branch, mrUrl, description }
 */

const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const NOTION_TOKEN = process.env.AVADA_NOTION_TOKEN;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_URL   = process.env.GITLAB_URL || 'https://gitlab.com';

// Map tên app trong Notion → appKey trong registry
const APP_NAME_MAP = {
  'app plaza image optimizer': 'avadaPlaza',
  'avada plaza':               'avadaPlaza',
  'app plaza':                 'avadaPlaza',
  'avada seo':                 'seo',
  'seo suite':                 'seo',
  'avada blogs':               'blogs',
  'blogs':                     'blogs',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function notionRequest(path) {
  const url = `https://api.notion.com/v1${path}`;
  const res = execSync(
    `curl -s "${url}" -H "Authorization: Bearer ${NOTION_TOKEN}" -H "Notion-Version: 2022-06-28"`,
    { stdio: 'pipe' }
  ).toString();
  return JSON.parse(res);
}

function extractPageId(notionUrl) {
  // Hỗ trợ các dạng URL Notion:
  // https://www.notion.so/workspace/Title-abc123def456
  // https://www.notion.so/abc123def456
  const match = notionUrl.match(/([a-f0-9]{32})(?:\?|$)/);
  if (match) return match[1];
  // Dạng có dấu gạch ngang trong ID
  const match2 = notionUrl.match(/([a-f0-9-]{36})(?:\?|$)/);
  if (match2) return match2[1].replace(/-/g, '');
  throw new Error(`Không parse được page ID từ URL: ${notionUrl}`);
}

function resolveAppKey(appNames) {
  for (const name of appNames) {
    const key = APP_NAME_MAP[name.toLowerCase().trim()];
    if (key) return key;
  }
  return null;
}

function resolveStagingHandle(appKey, stageNum) {
  const envKey = `STAGING_${stageNum}_${appKey.replace(/([A-Z])/g, '_$1').toUpperCase()}_HANDLE`;
  // avadaPlaza → STAGING_1_AVADA_PLAZA_HANDLE
  const handle = process.env[envKey];
  if (handle) return { handle, envKey };

  // Fallback: thử các biến thể tên
  const aliases = {
    avadaPlaza: ['AVADA_PLAZA', 'AVADAPLAZA'],
    seo:        ['SEO'],
    blogs:      ['BLOGS'],
  };
  for (const alias of (aliases[appKey] || [])) {
    const k = `STAGING_${stageNum}_${alias}_HANDLE`;
    if (process.env[k]) return { handle: process.env[k], envKey: k };
  }
  return { handle: null, envKey };
}

function getBranchFromMR(mrUrl) {
  // Parse: https://gitlab.com/group/project/-/merge_requests/123
  const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!match) return null;

  const projectPath = encodeURIComponent(match[1]);
  const mrId = match[2];

  try {
    const res = execSync(
      `curl -s "${GITLAB_URL}/api/v4/projects/${projectPath}/merge_requests/${mrId}" \
       -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}"`,
      { stdio: 'pipe' }
    ).toString();
    const data = JSON.parse(res);
    return data.source_branch || null;
  } catch {
    return null;
  }
}

function getBlocks(blockId) {
  const data = notionRequest(`/blocks/${blockId}/children?page_size=100`);
  return data.results || [];
}

function getText(richText) {
  return (richText || []).map(x => x.plain_text).join('').trim();
}

function getComments(pageId) {
  const data = notionRequest(`/comments?block_id=${pageId}`);
  return (data.results || []).map(c => getText(c.rich_text)).filter(Boolean);
}

// Đọc đệ quy tất cả to_do blocks (bug list)
function collectTodos(blocks, depth = 0) {
  const todos = [];
  for (const b of blocks) {
    if (b.type === 'to_do') {
      const text = getText(b.to_do.rich_text);
      const checked = b.to_do.checked;
      if (text) todos.push({ text, checked });
    }
    // Đọc children nếu có
    if (b.has_children && depth < 3) {
      try {
        const children = getBlocks(b.id);
        todos.push(...collectTodos(children, depth + 1));
      } catch {}
    }
  }
  return todos;
}

// Đọc text từ heading/paragraph để lấy staging store hint
function collectHeadings(blocks) {
  return blocks
    .filter(b => b.type.startsWith('heading') || b.type === 'paragraph')
    .map(b => getText(b[b.type].rich_text))
    .filter(Boolean);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Load context từ 1 Notion task page.
 *
 * @param {string} pageUrl - URL trang Notion của task
 * @returns {{
 *   appKey: string,
 *   appName: string,
 *   stageNum: number|null,
 *   stagingHandle: string|null,
 *   mrUrl: string|null,
 *   branch: string|null,
 *   description: string,   ← bug list + comments → dùng làm mô tả test
 *   rawBugs: Array,
 *   comments: string[],
 * }}
 */
async function loadNotionContext(pageUrl) {
  if (!NOTION_TOKEN) throw new Error('AVADA_NOTION_TOKEN chưa set trong .env');

  console.log('\n📋 Đọc Notion task...');

  const pageId = extractPageId(pageUrl);

  // 1. Lấy properties
  const page = notionRequest(`/pages/${pageId}`);
  if (page.object === 'error') throw new Error(`Notion: ${page.message}`);

  const props = page.properties;

  // App
  const appNames = (props.App?.multi_select || []).map(x => x.name);
  const appKey = resolveAppKey(appNames);
  if (!appKey) throw new Error(`Không nhận ra app: ${appNames.join(', ')}. Cập nhật APP_NAME_MAP trong notion-context.js`);

  const APP_DISPLAY = { avadaPlaza: 'Avada Plaza', seo: 'Avada SEO', blogs: 'Avada Blogs' };
  const appName = APP_DISPLAY[appKey] || appKey;

  // Stage
  const stageNum = props.Stage?.number ?? null;

  // MR
  const mrUrl = getText(props.MR?.rich_text) || null;

  // Title
  const title = getText(props['focus mode']?.title) || 'Task';

  // Status
  const status = props.Status?.status?.name || '';

  console.log(`  ✅ App: ${appName}`);
  console.log(`  ✅ Stage: ${stageNum ?? 'chưa set'}`);
  console.log(`  ✅ MR: ${mrUrl || 'chưa có'}`);
  console.log(`  ✅ Status: ${status}`);

  // 2. Resolve staging handle
  let stagingHandle = null;
  let envKey = null;
  if (stageNum) {
    const resolved = resolveStagingHandle(appKey, stageNum);
    stagingHandle = resolved.handle;
    envKey = resolved.envKey;
    if (stagingHandle) {
      console.log(`  ✅ Staging handle: ${stagingHandle} (từ ${envKey})`);
    } else {
      console.warn(`  ⚠️  Chưa có handle cho staging ${stageNum} (${envKey} chưa set trong .env)`);
    }
  }

  // 3. Lấy branch từ MR
  let branch = null;
  if (mrUrl && GITLAB_TOKEN) {
    console.log(`  🔀 Lấy branch từ GitLab MR...`);
    branch = getBranchFromMR(mrUrl);
    if (branch) console.log(`  ✅ Branch: ${branch}`);
    else console.warn(`  ⚠️  Không lấy được branch từ MR`);
  }

  // 4. Đọc nội dung trang (bug list)
  const blocks = getBlocks(pageId);
  const todos = collectTodos(blocks);
  const headings = collectHeadings(blocks);

  // Đọc children của các block có children (vd: heading chứa bug list)
  for (const b of blocks) {
    if (b.has_children) {
      try {
        const children = getBlocks(b.id);
        todos.push(...collectTodos(children));
      } catch {}
    }
  }

  // Dedup
  const seen = new Set();
  const uniqueTodos = todos.filter(t => {
    if (seen.has(t.text)) return false;
    seen.add(t.text);
    return true;
  });

  const openBugs   = uniqueTodos.filter(t => !t.checked);
  const doneBugs   = uniqueTodos.filter(t => t.checked);

  console.log(`  ✅ Bugs: ${openBugs.length} chưa fix, ${doneBugs.length} đã done`);

  // 5. Đọc comments
  const comments = getComments(pageId);
  console.log(`  ✅ Comments: ${comments.length}`);

  // 6. Build description cho AI
  const descParts = [`# Task: ${title}`, `App: ${appName}`, `Status: ${status}`, ''];

  if (openBugs.length) {
    descParts.push('## Bugs chưa fix (ưu tiên viết test regression):');
    openBugs.forEach((b, i) => descParts.push(`${i + 1}. ${b.text}`));
    descParts.push('');
  }

  if (doneBugs.length) {
    descParts.push('## Bugs đã fix (cần test regression để đảm bảo không tái phát):');
    doneBugs.forEach((b, i) => descParts.push(`${i + 1}. ${b.text}`));
    descParts.push('');
  }

  if (headings.length) {
    descParts.push('## Ghi chú trong trang:');
    headings.forEach(h => descParts.push(`- ${h}`));
    descParts.push('');
  }

  if (comments.length) {
    descParts.push('## Comments từ team:');
    comments.forEach(c => descParts.push(`- ${c}`));
    descParts.push('');
  }

  const description = descParts.join('\n');

  return {
    appKey,
    appName,
    stageNum,
    stagingHandle,
    envKey,
    mrUrl,
    branch,
    title,
    status,
    description,
    rawBugs: uniqueTodos,
    comments,
  };
}

module.exports = { loadNotionContext, extractPageId };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const urlArg = args.find((_, i) => args[i - 1] === '--page') || args[0];

  if (!urlArg) {
    console.error('Usage: node scripts/notion-context.js --page https://notion.so/...');
    process.exit(1);
  }

  loadNotionContext(urlArg).then(ctx => {
    console.log('\n══════════════════════════════════');
    console.log('Context extracted:');
    console.log(`  App:     ${ctx.appName} (${ctx.appKey})`);
    console.log(`  Stage:   ${ctx.stageNum}`);
    console.log(`  Handle:  ${ctx.stagingHandle || '(chưa set)'}`);
    console.log(`  Branch:  ${ctx.branch || '(chưa có)'}`);
    console.log(`  MR:      ${ctx.mrUrl || '(chưa có)'}`);
    console.log(`  Bugs:    ${ctx.rawBugs.length} total`);
    console.log(`  Comments:${ctx.comments.length}`);
    console.log('\nDescription preview:');
    console.log(ctx.description.slice(0, 500));
  }).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
