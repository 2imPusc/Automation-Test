#!/usr/bin/env node
/**
 * Context Sync Engine
 *
 * Kiểm tra context có up-to-date với branch/commit hiện tại không.
 * Nếu không → git pull + re-extract tự động.
 *
 * Logic:
 *   1. Đọc apps-registry.json → lấy repoPath, srcPath
 *   2. git -C repoPath rev-parse HEAD → lấy commit hiện tại của branch
 *   3. Đọc _overview.md → so sánh branch + commit
 *   4. Nếu match → return { upToDate: true }
 *   5. Nếu không → git pull → extract.py → update _overview.md frontmatter
 *
 * Export: checkAndSync(appKey, branch) → { upToDate, updated, contextDir }
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'skills/shopify-test-gen/references/apps-registry.json');
const EXTRACT_SCRIPT = path.join(ROOT, 'skills/app-context-extractor/scripts/extract.py');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
}

function git(args, cwd) {
  try {
    return execSync(`git ${args}`, { cwd, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * Đọc YAML frontmatter từ _overview.md
 * Format:
 *   ---
 *   branch: main
 *   commit: abc1234
 *   extracted_at: 2026-03-20
 *   ---
 */
function readOverviewMeta(overviewPath) {
  if (!fs.existsSync(overviewPath)) return {};
  const content = fs.readFileSync(overviewPath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const meta = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  }
  return meta;
}

/**
 * Ghi/update YAML frontmatter vào _overview.md
 */
function updateOverviewMeta(overviewPath, meta) {
  let content = fs.existsSync(overviewPath) ? fs.readFileSync(overviewPath, 'utf-8') : '';

  const frontmatter = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n');
  const block = `---\n${frontmatter}\n---\n`;

  if (content.startsWith('---')) {
    // Replace existing frontmatter
    content = content.replace(/^---\n[\s\S]*?\n---\n/, block);
  } else {
    // Prepend
    content = block + '\n' + content;
  }

  fs.writeFileSync(overviewPath, content);
}

/**
 * Chạy extract.py để re-generate context files.
 */
function runExtract(appKey, appName, srcPath, localePath, contextDir) {
  console.log(`  🔄 Extracting context từ source...`);

  const result = spawnSync('python3', [
    EXTRACT_SCRIPT,
    '--app-key', appKey,
    '--app-name', appName,
    '--src', srcPath,
    '--locale', localePath,
    '--split-by-page',
    '--out', contextDir,
  ], { stdio: ['pipe', 'pipe', 'inherit'] });

  return result.status === 0;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Check context và sync nếu cần.
 *
 * @param {string} appKey - key trong registry (e.g. 'avadaPlaza')
 * @param {string} branch - branch tester muốn test (e.g. 'feature/new-ui')
 * @returns {{ upToDate: boolean, updated: boolean, contextDir: string, error?: string }}
 */
async function checkAndSync(appKey, branch) {
  const registry = readRegistry();
  const app = registry[appKey];

  if (!app) {
    return { upToDate: false, updated: false, contextDir: '', error: `App "${appKey}" không có trong registry.` };
  }

  const repoPath = app.repoPath;
  const srcPath = path.join(repoPath, app.srcPath);
  const localePath = path.join(repoPath, app.localePath);
  const contextDir = path.join(ROOT, app.contextDir);
  const overviewPath = path.join(contextDir, '_overview.md');

  // 1. Kiểm tra repo tồn tại
  if (!fs.existsSync(repoPath)) {
    return { upToDate: false, updated: false, contextDir, error: `Repo không tồn tại: ${repoPath}\nChạy: npm run setup-apps` };
  }

  // 2. Checkout branch (nếu cần)
  console.log(`  📦 ${app.name} — branch: ${branch}`);
  const currentBranch = git('rev-parse --abbrev-ref HEAD', repoPath);

  if (currentBranch !== branch) {
    console.log(`  🔀 Switching branch: ${currentBranch} → ${branch}`);
    const checkout = spawnSync('git', ['checkout', branch], { cwd: repoPath, stdio: 'inherit' });
    if (checkout.status !== 0) {
      return { upToDate: false, updated: false, contextDir, error: `Không thể checkout branch "${branch}"` };
    }
  }

  // 3. LUÔN pull trước khi làm bất cứ điều gì khác
  //    → đảm bảo context được extract từ code mới nhất, không bao giờ dùng code cũ
  console.log(`  ⬇️  Pulling latest from origin/${branch}...`);
  const pullResult = spawnSync('git', ['pull', 'origin', branch], {
    cwd: repoPath,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (pullResult.status !== 0) {
    // Pull fail không chặn hoàn toàn (có thể offline / no remote)
    // nhưng warn rõ ràng
    console.warn(`  ⚠️  Pull failed: ${(pullResult.stderr || '').trim().split('\n')[0]}`);
    console.warn(`  → Tiếp tục với code hiện tại trên máy.`);
  } else {
    const pullMsg = (pullResult.stdout || '').trim();
    if (pullMsg && pullMsg !== 'Already up to date.') {
      console.log(`  ✅ Pulled: ${pullMsg.split('\n')[0]}`);
    } else {
      console.log(`  ✅ Already up to date.`);
    }
  }

  // 4. Lấy commit SAU KHI pull
  const currentCommit = git('rev-parse --short HEAD', repoPath);

  // 5. So sánh với meta trong _overview.md
  const meta = readOverviewMeta(overviewPath);
  const isSameBranch = meta.branch === branch;
  const isSameCommit = meta.commit === currentCommit;

  if (isSameBranch && isSameCommit && fs.existsSync(overviewPath)) {
    console.log(`  ✅ Context up-to-date (branch: ${branch}, commit: ${currentCommit})`);
    return { upToDate: true, updated: false, contextDir };
  }

  // 6. Re-extract
  console.log(`  📝 Context outdated (${meta.commit || 'none'} → ${currentCommit}), re-extracting...`);
  const ok = runExtract(appKey, app.name, srcPath, localePath, contextDir);

  if (!ok) {
    return { upToDate: false, updated: false, contextDir, error: 'extract.py thất bại' };
  }

  // 7. Update frontmatter
  updateOverviewMeta(overviewPath, {
    app: appKey,
    branch,
    commit: currentCommit,
    extracted_at: new Date().toISOString().split('T')[0],
    src: srcPath,
  });

  console.log(`  ✅ Context updated (commit: ${currentCommit})`);
  return { upToDate: false, updated: true, contextDir };
}

module.exports = { checkAndSync, readRegistry };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const appKey = args.find((_, i) => args[i - 1] === '--app') || 'avadaPlaza';
  const branch = args.find((_, i) => args[i - 1] === '--branch') || 'master';

  console.log('\n🔄 Context Sync');
  console.log('─────────────────────────────────────');

  checkAndSync(appKey, branch).then(result => {
    if (result.error) {
      console.error(`\n❌ ${result.error}`);
      process.exit(1);
    }
    if (result.upToDate) {
      console.log('\n✅ Context đã up-to-date, không cần sync.');
    } else {
      console.log('\n✅ Context đã được sync xong.');
    }
  });
}
