#!/usr/bin/env node
/**
 * Test Runner — chạy test sau khi staging đã deploy xong.
 *
 * Flow:
 *   1. Đọc last-task.json → hỏi "Dùng task trước?"
 *      Nếu N hoặc không có → hỏi Notion URL → load context mới
 *   2. verifyStagingDeploy() → check branch đang deploy trên staging
 *      ✅ match   → chạy test
 *      ❌ mismatch → warn rõ + exit
 *      ❓ not found → warn nhẹ + vẫn cho chạy
 *   3. npx playwright test --project=chromium [testFiles...]
 *
 * Usage:
 *   npm run test:run
 */

const readline = require('readline');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { verifyStagingDeploy, parseProjectPath } = require('./staging-verify');
const { loadNotionContext } = require('./notion-context');
const { checkAndSync } = require('./context-sync');

const ROOT = path.join(__dirname, '..');
const LAST_TASK_FILE = path.join(ROOT, 'last-task.json');

const ask = (rl, q) => new Promise(resolve => rl.question(q, resolve));

// ── Helpers ───────────────────────────────────────────────────────────────────

function readLastTask() {
  if (!fs.existsSync(LAST_TASK_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LAST_TASK_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '?';
  const d = new Date(isoStr);
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Test Runner');
  console.log('─────────────────────────────────────────────────');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let task = null;

  // 1. Đọc last-task.json
  const lastTask = readLastTask();

  if (lastTask) {
    console.log(`\n📋 Task trước:`);
    console.log(`   Branch:  ${lastTask.branch}`);
    console.log(`   Staging: ${lastTask.stageNum ?? 'N/A'}`);
    console.log(`   App:     ${lastTask.appKey}`);
    console.log(`   Files:   ${(lastTask.testFiles || []).join(', ') || '(không có)'}`);
    console.log(`   Tạo lúc: ${formatDate(lastTask.generatedAt)}`);

    const useOld = await ask(rl, `\nDùng task trước (branch: ${lastTask.branch}, staging: ${lastTask.stageNum ?? 'N/A'})? [Y/n]: `);

    if (useOld.trim().toLowerCase() !== 'n') {
      task = lastTask;
    }
  }

  // Nếu không dùng task cũ → load mới từ Notion
  if (!task) {
    console.log('\n📝 Nhập Notion task URL để load context mới...');
    const notionUrl = await ask(rl, 'Notion task URL: ');

    if (!notionUrl.trim().includes('notion.so')) {
      console.error('❌ URL Notion không hợp lệ.');
      rl.close();
      process.exit(1);
    }

    rl.close();

    const ctx = await loadNotionContext(notionUrl.trim());

    // Xác định projectPath
    let projectPath = null;
    if (ctx.mrUrl) {
      try { projectPath = parseProjectPath(ctx.mrUrl); } catch {}
    }

    // Sync context (để có testFiles nếu cần)
    console.log('\n🔄 Syncing context...');
    const sync = await checkAndSync(ctx.appKey, ctx.branch || 'master', ctx.mrUrl || null);
    if (sync.error) {
      console.error(`❌ ${sync.error}`);
      process.exit(1);
    }

    // Lấy test files từ last-task.json nếu có (vì vừa load Notion mà không gen mới)
    const existingTask = readLastTask();
    const testFiles = (existingTask && existingTask.appKey === ctx.appKey)
      ? (existingTask.testFiles || [])
      : [];

    task = {
      notionUrl:   notionUrl.trim(),
      appKey:      ctx.appKey,
      branch:      ctx.branch || 'master',
      stageNum:    ctx.stageNum || null,
      mrUrl:       ctx.mrUrl || null,
      projectPath,
      testFiles,
      generatedAt: existingTask?.generatedAt || new Date().toISOString(),
    };

    if (testFiles.length === 0) {
      console.warn('\n⚠️  Không có test files. Chạy npm run test:generate trước để tạo tests.');
      process.exit(1);
    }

  } else {
    rl.close();
  }

  // 2. Verify staging deploy
  const { branch, stageNum, projectPath, mrUrl, testFiles = [] } = task;

  if (!projectPath && mrUrl) {
    try { task.projectPath = parseProjectPath(mrUrl); } catch {}
  }

  console.log('\n🔍 Kiểm tra staging deploy...');

  if (!task.projectPath) {
    console.warn('⚠️  Không có projectPath để verify staging. Bỏ qua kiểm tra.');
  } else if (!stageNum) {
    console.warn('⚠️  Không có stageNum để verify staging. Bỏ qua kiểm tra.');
  } else {
    const result = await verifyStagingDeploy(task.projectPath, stageNum, branch);

    if (!result.found) {
      console.warn(`\n❓ Không tìm thấy deployment cho staging ${stageNum}.`);
      console.warn(`   Không thể xác nhận branch đang deploy — tiếp tục chạy test.\n`);
      // found: false → warn nhẹ + vẫn cho chạy (không exit)

    } else if (!result.match) {
      console.error(`\n⚠️  Staging ${stageNum} đang deploy '${result.deployedBranch}'`);
      console.error(`   Cần deploy '${branch}' lên staging ${stageNum} trước.`);
      console.error(`   Sau khi deploy xong: npm run test:run`);
      process.exit(1);

    } else {
      console.log(`\n✅ Staging ${stageNum} đang deploy đúng branch: '${branch}'`);
    }
  }

  // 3. Run tests
  if (testFiles.length === 0) {
    console.warn('\n⚠️  Không có test files được chỉ định. Chạy tất cả tests.');
  } else {
    console.log(`\n🧪 Chạy tests: ${testFiles.join(', ')}`);
  }

  console.log('─────────────────────────────────────────────────\n');

  const args = testFiles.length
    ? ['playwright', 'test', '--project=chromium', ...testFiles]
    : ['playwright', 'test', '--project=chromium'];

  const result = spawnSync('npx', args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  process.exit(result.status || 0);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
