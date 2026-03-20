#!/usr/bin/env node
/**
 * AI Test Generator — sinh Playwright test từ mô tả tự nhiên.
 *
 * Flow:
 *  1. Hỏi app + branch + mô tả feature
 *  2. context-sync: git pull → check context → re-extract nếu cần
 *  3. Load snapshots + app context → inject vào prompt
 *  4. Claude Code viết test
 *  5. Chạy test → retry tối đa 3 lần nếu fail
 *
 * Usage:
 *   npm run test:generate
 *   npm run test:generate -- --run       (skip hỏi chạy ngay)
 *   npm run test:generate -- --no-retry  (tắt retry loop)
 */

const readline = require('readline');
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkAndSync, readRegistry } = require('./context-sync');

const ROOT = path.join(__dirname, '..');
const SKILL_FILE = path.join(ROOT, 'skills/shopify-test-gen/SKILL.md');
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');
const SNAPSHOTS_INDEX = path.join(SNAPSHOTS_DIR, 'index.json');
const MAX_RETRIES = 3;

const ask = (rl, q) => new Promise(resolve => rl.question(q, resolve));

// ── Check claude CLI ──────────────────────────────────────────────────────────
function checkClaude() {
  try { execSync('which claude', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

// ── Gather inputs from tester ─────────────────────────────────────────────────
async function gatherInputs() {
  const registry = readRegistry();
  const appKeys = Object.keys(registry).filter(k => k !== '_comment');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🤖 AI Test Generator');
  console.log('─────────────────────────────────────────────────');

  // 1. Chọn app
  console.log('\nApps có sẵn:');
  appKeys.forEach((k, i) => {
    const app = registry[k];
    console.log(`  ${i + 1}. ${app.name} (${k})`);
  });
  console.log('');

  let appKey = '';
  while (!appKey) {
    const input = await ask(rl, `Chọn app (1-${appKeys.length} hoặc tên key): `);
    const num = parseInt(input.trim());
    if (!isNaN(num) && num >= 1 && num <= appKeys.length) {
      appKey = appKeys[num - 1];
    } else if (appKeys.includes(input.trim())) {
      appKey = input.trim();
    } else {
      console.log('  ⚠️  Không hợp lệ, thử lại.');
    }
  }

  // 2. Branch
  const app = registry[appKey];
  let defaultBranch = 'master';
  try {
    defaultBranch = execSync(`git -C ${app.repoPath} rev-parse --abbrev-ref HEAD`, { stdio: 'pipe' }).toString().trim();
  } catch {}

  const branchInput = await ask(rl, `Branch [${defaultBranch}]: `);
  const branch = branchInput.trim() || defaultBranch;

  // 3. Mô tả
  console.log('\nMô tả feature/flow cần test (tiếng Việt hoặc English).');
  console.log('Gợi ý:');
  console.log('  Feature: [tên feature/trang]');
  console.log('  Flow: [các bước + điều cần kiểm tra]');
  console.log('Nhấn Enter 2 lần khi xong.\n');

  let lines = [];
  let emptyCount = 0;

  await new Promise(resolve => {
    rl.on('line', line => {
      if (line === '') {
        emptyCount++;
        if (emptyCount >= 2) { rl.close(); resolve(); }
      } else {
        emptyCount = 0;
        lines.push(line);
      }
    });
    rl.on('close', resolve);
  });

  return { appKey, branch, description: lines.join('\n').trim(), appName: app.name };
}

// ── Load snapshots context ────────────────────────────────────────────────────
function loadSnapshotsContext(appKey) {
  if (!fs.existsSync(SNAPSHOTS_INDEX)) return null;
  const index = JSON.parse(fs.readFileSync(SNAPSHOTS_INDEX, 'utf-8'));
  const snaps = (index.snapshots || []).filter(s => s.app === appKey);
  if (!snaps.length) return null;

  const sections = [];
  for (const snap of snaps) {
    const jsonPath = path.join(ROOT, snap.json);
    if (!fs.existsSync(jsonPath)) continue;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const dom = data.dom || {};
    const lines = [`### Snapshot: ${snap.app}/${snap.page}`, `Screenshot: ${snap.screenshot}`, ''];
    if (dom.buttons?.length) {
      lines.push('**Buttons:**');
      dom.buttons.slice(0, 15).forEach(b => { if (b.text) lines.push(`  - "${b.text}"`); });
      lines.push('');
    }
    if (dom.links?.length) {
      lines.push('**Nav links:**');
      dom.links.forEach(l => lines.push(`  - "${l}"`));
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }
  return sections.length ? sections.join('\n---\n') : null;
}

// ── Load app context (overview + feature files) ────────────────────────────────
function loadAppContext(contextDir, description) {
  const overviewPath = path.join(contextDir, '_overview.md');
  if (!fs.existsSync(overviewPath)) return null;

  // Luôn load overview
  const overview = fs.readFileSync(overviewPath, 'utf-8');

  // Tìm feature file phù hợp với mô tả (simple keyword match)
  const featureFiles = fs.readdirSync(contextDir)
    .filter(f => f.endsWith('.md') && f !== '_overview.md' && !f.endsWith('.scanned.md'));

  const descLower = description.toLowerCase();
  let matchedFile = null;
  let bestScore = 0;

  for (const file of featureFiles) {
    const name = file.replace('.md', '').replace(/-/g, ' ');
    // Score: số keywords trong tên file match với mô tả
    const score = name.split(' ').filter(word => descLower.includes(word)).length;
    if (score > bestScore) { bestScore = score; matchedFile = file; }
  }

  // Fallback: load file đầu tiên nếu không match
  if (!matchedFile && featureFiles.length) matchedFile = featureFiles[0];

  let featureContext = '';
  if (matchedFile) {
    const filePath = path.join(contextDir, matchedFile);
    featureContext = fs.readFileSync(filePath, 'utf-8');
    console.log(`  📄 Loaded feature context: ${matchedFile}`);
  }

  return { overview, featureContext, matchedFile };
}

// ── Build prompt ──────────────────────────────────────────────────────────────
function buildPrompt({ appKey, appName, branch, description, contextDir, snapshotsContext }) {
  const skill = fs.readFileSync(SKILL_FILE, 'utf-8');
  const ctx = loadAppContext(contextDir, description);

  const appContextSection = ctx ? `
## App Context — ${appName} (branch: ${branch})

### Overview
${ctx.overview}

### Feature Context${ctx.matchedFile ? ` (${ctx.matchedFile})` : ''}
${ctx.featureContext}
` : `## App Context\n_No context found. Using best-guess selectors._\n`;

  const snapshotSection = snapshotsContext ? `
## UI Snapshots (DOM from real app)
${snapshotsContext}
` : '';

  return `${skill}

---

${appContextSection}
${snapshotSection}

## Request

**App:** ${appName} (key: \`${appKey}\`)
**Branch:** ${branch}

${description}

---

## Instructions

1. Read codebase context files listed in SKILL.md Step 1a
2. Use EXACT button/toast/label text from App Context above — do NOT guess
3. Create Page Object + spec file following patterns in SKILL.md
4. Run \`npx playwright test --list\` to validate
5. Print summary

Working directory: ${ROOT}
`;
}

// ── Run test + collect errors ─────────────────────────────────────────────────
function runTests(testFiles) {
  const args = testFiles.length
    ? ['playwright', 'test', '--project=chromium', ...testFiles]
    : ['playwright', 'test', '--project=chromium'];

  const result = spawnSync('npx', args, {
    cwd: ROOT, stdio: 'pipe', shell: true, encoding: 'utf-8',
  });

  return {
    passed: result.status === 0,
    output: (result.stdout || '') + (result.stderr || ''),
  };
}

// ── Detect newly created test files ──────────────────────────────────────────
function detectNewTestFiles(beforeFiles) {
  const after = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.spec.ts')) after.add(path.join(dir, entry.name));
    }
  };
  walk(path.join(ROOT, 'tests'));
  return [...after].filter(f => !beforeFiles.has(f)).map(f => path.relative(ROOT, f));
}

function collectTestFiles() {
  const files = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.spec.ts')) files.add(path.join(dir, entry.name));
    }
  };
  walk(path.join(ROOT, 'tests'));
  return files;
}

// ── Claude runner ─────────────────────────────────────────────────────────────
function runClaude(prompt) {
  const tmpFile = path.join(os.tmpdir(), `test-gen-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt);
  const result = spawnSync('claude', [
    '--permission-mode', 'bypassPermissions', '--print', `$(cat ${tmpFile})`,
  ], { cwd: ROOT, stdio: 'inherit', shell: true });
  try { fs.unlinkSync(tmpFile); } catch {}
  return result.status === 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');
  const noRetry = args.includes('--no-retry');

  if (!checkClaude()) {
    console.error('❌ Claude Code CLI chưa cài. Xem: https://claude.ai/code');
    process.exit(1);
  }

  // 1. Gather inputs
  const { appKey, branch, description, appName } = await gatherInputs();
  if (!description) { console.error('❌ Mô tả trống.'); process.exit(1); }

  // 2. Sync context
  console.log('\n🔄 Syncing context...');
  const sync = await checkAndSync(appKey, branch);
  if (sync.error) { console.error(`❌ ${sync.error}`); process.exit(1); }

  // 3. Load snapshots
  const snapshotsContext = loadSnapshotsContext(appKey);
  if (snapshotsContext) console.log('  ✅ Snapshots loaded');

  // 4. Build prompt
  const prompt = buildPrompt({
    appKey, appName, branch, description,
    contextDir: sync.contextDir,
    snapshotsContext,
  });

  // 5. Claude generates test
  console.log('\n⏳ Claude Code đang tạo test...\n');
  console.log('─────────────────────────────────────────────────');

  const beforeFiles = collectTestFiles();
  const ok = runClaude(prompt);

  console.log('─────────────────────────────────────────────────');

  if (!ok) { console.error('❌ Claude Code lỗi.'); process.exit(1); }

  const newFiles = detectNewTestFiles(beforeFiles);

  // 6. Auto-run + retry loop
  if (newFiles.length > 0) {
    console.log(`\n📋 Files tạo mới: ${newFiles.join(', ')}`);

    if (autoRun || await askYN('\n▶ Chạy test ngay?')) {
      let attempt = 0;
      let passed = false;

      while (attempt < (noRetry ? 1 : MAX_RETRIES) && !passed) {
        attempt++;
        console.log(`\n🧪 Chạy test (lần ${attempt})...`);
        const { passed: p, output } = runTests(newFiles);

        if (p) {
          passed = true;
          console.log('\n✅ Tất cả tests PASS!');
        } else if (attempt < MAX_RETRIES && !noRetry) {
          console.log(`\n⚠️  Test fail. Đang cho Claude sửa (lần ${attempt}/${MAX_RETRIES - 1})...`);
          const fixPrompt = `${prompt}

## Test failed — please fix

The following tests were created but failed. Read the error output carefully and fix the selectors or logic.

**Failed files:** ${newFiles.join(', ')}

**Error output:**
\`\`\`
${output.slice(-3000)}
\`\`\`

Fix the issues and run \`npx playwright test --list\` to validate syntax.
Do NOT create new files — only fix the existing ones listed above.
`;
          runClaude(fixPrompt);
        } else {
          console.log('\n❌ Tests vẫn fail sau retry.');
          console.log('👉 Chạy để debug: npm run test:headed');
          console.log(`👉 Xem screenshot: playwright-report/`);
        }
      }
    }
  } else {
    // Claude không tạo file mới — hỏi chạy hết
    if (!autoRun) {
      const runAll = await askYN('\n▶ Chạy tất cả tests?');
      if (runAll) {
        spawnSync('npx', ['playwright', 'test', '--project=chromium'], {
          cwd: ROOT, stdio: 'inherit', shell: true,
        });
      }
    }
  }

  console.log('');
}

function askYN(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} (y/n): `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
