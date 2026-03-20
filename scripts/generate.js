#!/usr/bin/env node
/**
 * AI Test Generator — sinh Playwright test từ mô tả tự nhiên.
 *
 * Flow:
 *  1. Load snapshots (DOM info từ app thật)
 *  2. Load app context (curated + scanned)
 *  3. Claude Code đọc context → viết test
 *  4. Chạy test → nếu fail → feed error lại cho Claude (retry tối đa 3 lần)
 *
 * Usage:
 *   npm run test:generate
 *   npm run test:generate -- --run       (tạo xong chạy luôn, không hỏi)
 *   npm run test:generate -- --no-retry  (tắt retry loop)
 */

const readline = require('readline');
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SKILL_FILE = path.join(ROOT, 'skills/shopify-test-gen/SKILL.md');
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');
const SNAPSHOTS_INDEX = path.join(SNAPSHOTS_DIR, 'index.json');
const CONTEXT_DIR = path.join(ROOT, 'skills/shopify-test-gen/references/app-context');
const MAX_RETRIES = 3;

// ── Checks ───────────────────────────────────────────────────────────────────
function checkClaude() {
  try { execSync('which claude', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

// ── Load contexts ─────────────────────────────────────────────────────────────

function loadSnapshotsContext() {
  if (!fs.existsSync(SNAPSHOTS_INDEX)) return null;
  const index = JSON.parse(fs.readFileSync(SNAPSHOTS_INDEX, 'utf-8'));
  if (!index.snapshots?.length) return null;

  const sections = [];
  for (const snap of index.snapshots) {
    const jsonPath = path.join(ROOT, snap.json);
    if (!fs.existsSync(jsonPath)) continue;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const dom = data.dom || {};
    const lines = [
      `### Snapshot: ${snap.app} / ${snap.page}`,
      `Screenshot: ${snap.screenshot}`,
      `URL: ${data.url || ''}`,
    ];
    if (dom.buttons?.length) {
      lines.push('**Buttons:**');
      dom.buttons.slice(0, 20).forEach(b => {
        if (b.text) lines.push(`  - "${b.text}"${b.ariaLabel ? ` [aria: "${b.ariaLabel}"]` : ''}`);
      });
    }
    if (dom.links?.length) {
      lines.push('**Nav links:**');
      dom.links.forEach(l => lines.push(`  - "${l}"`));
    }
    if (dom.inputs?.length) {
      lines.push('**Inputs:**');
      dom.inputs.forEach(i => {
        const label = i.label || i.ariaLabel || i.placeholder || i.name;
        lines.push(`  - type="${i.type}" label="${label}"`);
      });
    }
    sections.push(lines.join('\n'));
  }
  return sections.join('\n---\n');
}

function loadAppContext() {
  if (!fs.existsSync(CONTEXT_DIR)) return null;

  const files = fs.readdirSync(CONTEXT_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(CONTEXT_DIR, f));

  if (!files.length) return null;

  return files.map(f => {
    const name = path.basename(f, '.md');
    return `### App Context: ${name}\n\n${fs.readFileSync(f, 'utf-8')}`;
  }).join('\n\n---\n\n');
}

// ── Detect newly created test files ──────────────────────────────────────────
function getTestFiles() {
  const testDir = path.join(ROOT, 'tests');
  const files = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.spec.ts')) files.push(full);
    }
  };
  walk(testDir);
  return files;
}

function getRecentTestFiles(beforeFiles) {
  const afterFiles = getTestFiles();
  return afterFiles.filter(f => !beforeFiles.includes(f));
}

// ── Run tests + collect errors ───────────────────────────────────────────────
function runTests(files) {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', '--project=chromium', '--reporter=list', ...files],
    { cwd: ROOT, encoding: 'utf-8', shell: true }
  );
  return {
    passed: result.status === 0,
    output: (result.stdout || '') + (result.stderr || ''),
    exitCode: result.status,
  };
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildGeneratePrompt(description, snapshotsContext, appContext) {
  const skill = fs.readFileSync(SKILL_FILE, 'utf-8');

  const snapshotSection = snapshotsContext
    ? `## UI Snapshots (real DOM from app)\n\n${snapshotsContext}\n\n---\n`
    : `## UI Snapshots\n\nNo snapshots. Add \`// TODO: verify selector\` for uncertain selectors.\nTip: Run \`npm run snapshot\` first.\n\n---\n`;

  const contextSection = appContext
    ? `## App Context (curated from source code)\n\nPrioritise these exact strings for selectors and assertions.\n\n${appContext}\n\n---\n`
    : '';

  return `${skill}\n\n---\n\n${snapshotSection}\n${contextSection}\n## Tester Request\n\n${description}\n\n---\n\n## Instructions\n\n1. Read context files listed in SKILL.md\n2. Use exact UI strings from App Context above for getByText/getByRole selectors\n3. Use exact toast messages from App Context for assertions\n4. Create Page Object + spec file\n5. Run \`npx playwright test --list\` to validate syntax\n6. Print summary\n\nWorking directory: ${ROOT}\n`;
}

function buildRetryPrompt(errorOutput, attemptNum) {
  return `The tests you generated failed on attempt ${attemptNum}. Please fix them.

## Test Error Output

\`\`\`
${errorOutput.slice(0, 3000)}
\`\`\`

## Instructions

1. Read the error carefully — identify which selector/assertion is wrong
2. Fix only what's needed (selector, timeout, assertion text)
3. Use exact UI strings from the App Context if available
4. Run \`npx playwright test --list\` after fixing
5. Print a short summary of what you changed

Working directory: ${ROOT}
`;
}

// ── Claude runner ─────────────────────────────────────────────────────────────
function runClaude(prompt) {
  const tmpFile = path.join(os.tmpdir(), `shopify-gen-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  const result = spawnSync(
    'claude',
    ['--permission-mode', 'bypassPermissions', '--print', `$(cat ${tmpFile})`],
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );

  try { fs.unlinkSync(tmpFile); } catch {}
  return result.status === 0;
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function askDescription() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n🤖 AI Test Generator');
    console.log('─────────────────────────────────────────────────');
    console.log('Mô tả feature/flow cần test. Nhấn Enter 2 lần khi xong.\n');
    let lines = [], emptyCount = 0;
    rl.on('line', (line) => {
      if (line === '') { emptyCount++; if (emptyCount >= 2) { rl.close(); resolve(lines.join('\n').trim()); } }
      else { emptyCount = 0; lines.push(line); }
    });
    rl.on('close', () => resolve(lines.join('\n').trim()));
  });
}

function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim().toLowerCase() === 'y'); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');
  const noRetry = args.includes('--no-retry');

  if (!checkClaude()) {
    console.error('\n❌ Claude Code CLI không tìm thấy. Cài tại: https://claude.ai/code');
    process.exit(1);
  }

  // Load contexts
  const snapshotsContext = loadSnapshotsContext();
  const appContext = loadAppContext();

  console.log('');
  if (appContext) console.log('✅ App context loaded — AI sẽ dùng UI strings chính xác từ source code.');
  else console.log('💡 Chưa có app context. Chạy `npm run scan-source` để tăng độ chính xác.');
  if (snapshotsContext) console.log('✅ Snapshots loaded — AI sẽ dùng DOM info từ app thật.');
  else console.log('💡 Chưa có snapshots. Chạy `npm run snapshot` để tăng độ chính xác.');

  // Get description
  const description = await askDescription();
  if (!description) { console.error('\n❌ Mô tả trống.'); process.exit(1); }

  // Track files before generation
  const filesBefore = getTestFiles();

  // Generate
  console.log('\n⏳ Đang tạo test...\n');
  console.log('─────────────────────────────────────────────────');
  const generateOk = runClaude(buildGeneratePrompt(description, snapshotsContext, appContext));
  console.log('\n─────────────────────────────────────────────────');

  if (!generateOk) {
    console.error('\n❌ Claude Code gặp lỗi khi tạo test.');
    process.exit(1);
  }

  // Detect new files
  const newFiles = getRecentTestFiles(filesBefore);

  // Ask to run (or auto-run)
  const shouldRun = autoRun || await askYesNo('\n▶ Chạy test ngay? (y/n): ');
  if (!shouldRun) {
    console.log('\n💡 Chạy sau: npm run test:pick\n');
    return;
  }

  if (newFiles.length === 0) {
    console.log('\n⚠️  Không detect được file test mới. Chạy toàn bộ tests...');
    spawnSync('npx', ['playwright', 'test', '--project=chromium'], { cwd: ROOT, stdio: 'inherit', shell: true });
    return;
  }

  // Run với retry loop
  const filesToRun = newFiles.map(f => path.relative(ROOT, f));
  console.log(`\n▶ Chạy: ${filesToRun.join(', ')}\n`);

  let attempt = 0;
  let passed = false;

  while (attempt < (noRetry ? 1 : MAX_RETRIES)) {
    attempt++;
    console.log(`\n─── Attempt ${attempt}/${noRetry ? 1 : MAX_RETRIES} ───────────────────────────────`);

    const { passed: ok, output } = runTests(filesToRun);

    if (ok) {
      passed = true;
      console.log('\n✅ Tất cả tests passed!');
      break;
    }

    if (noRetry || attempt >= MAX_RETRIES) {
      console.log('\n❌ Tests vẫn fail sau tất cả attempts.');
      console.log('💡 Chạy `npm run test:headed` để debug thủ công.');
      break;
    }

    // Retry: feed error lại cho Claude
    console.log(`\n⚠️  Tests fail. Đang yêu cầu Claude tự sửa (attempt ${attempt + 1}/${MAX_RETRIES})...`);
    console.log('─────────────────────────────────────────────────');
    const retryOk = runClaude(buildRetryPrompt(output, attempt));
    console.log('─────────────────────────────────────────────────');

    if (!retryOk) {
      console.error('\n❌ Claude gặp lỗi khi sửa. Dừng retry.');
      break;
    }
  }

  if (passed) {
    console.log('\n🎉 Done! Test files:');
    newFiles.forEach(f => console.log(`   ${path.relative(ROOT, f)}`));
    console.log('\n💡 Xem report: npm run report\n');
  }
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
});
