import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

// In-memory store for active runs
const activeRuns = new Map<
  string,
  { process: ReturnType<typeof spawn>; logs: string[]; done: boolean; exitCode: number | null; startedAt: string; suite: string; env: string }
>();

// Make it accessible from the stream route
(globalThis as Record<string, unknown>).__activeRuns = activeRuns;

const SUITE_COMMANDS: Record<string, string[]> = {
  all: ["npx", "playwright", "test", "--project=chromium"],
  "avada-plaza": ["npx", "playwright", "test", "--project=chromium", "tests/avada-plaza/"],
  seo: ["npx", "playwright", "test", "--project=chromium", "tests/seo/"],
  blogs: ["npx", "playwright", "test", "--project=chromium", "tests/blogs/"],
  smoke: ["npx", "playwright", "test", "--project=chromium", "--grep", "@smoke"],
  recorded: ["npx", "playwright", "test", "--project=chromium", "recorded-features/"],
};

// Log bước tiến trình (không phải test result)
function logStep(run: { logs: string[] }, msg: string) {
  run.logs.push(`STEP: ${msg}`);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    suite = "all",
    env = "local",
    locale = "en",
    notionUrl = "",
    headed = false,
    testFiles,
    mrUrl,
    stageNum,
    expectedBranch,
    appKey,
  } = body as {
    suite?: string;
    env?: string;
    locale?: string;
    notionUrl?: string;
    headed?: boolean;
    testFiles?: string[];
    mrUrl?: string;
    stageNum?: number;
    expectedBranch?: string;
    appKey?: string;
  };

  const runId = crypto.randomUUID();
  const projectRoot = path.resolve(path.join(process.cwd(), ".."));

  // Load root .env vào envVars — Next.js chỉ load web/.env.local, không load root .env
  const envVars: NodeJS.ProcessEnv = { ...process.env };


  try {
    const rootEnvPath = path.join(projectRoot, ".env");
    if (fs.existsSync(rootEnvPath)) {
      const lines = fs.readFileSync(rootEnvPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (key && !envVars[key]) envVars[key] = val;
      }
    }
  } catch { /* ignore */ }

  if (env === "staging") envVars.ENV = "staging";
  if (env === "prod") envVars.ENV = "prod";
  if (notionUrl) envVars.NOTION_URL = notionUrl;
  // Luôn override TEST_LOCALE từ UI — tránh bị shell env leak từ session cũ
  envVars.TEST_LOCALE = locale;

  // Khi chạy staging với stageNum cụ thể, inject handles vào envVars
  // để Playwright dùng đúng handle mà không cần biết stageNum
  if (env === "staging" && stageNum) {
    const appKeyMap: Record<string, string> = { avadaPlaza: "AVADA_PLAZA", seo: "SEO", blogs: "BLOGS" };
    for (const [, prefix] of Object.entries(appKeyMap)) {
      const stagingKey = `STAGING_${stageNum}_${prefix}_HANDLE`;
      const handle = envVars[stagingKey];
      if (handle) {
        // Ghi đè key mà helpers/apps.ts đang đọc (STAGING_AVADA_PLAZA_HANDLE)
        envVars[`STAGING_${prefix}_HANDLE`] = handle;
      }
    }
  }

  const effectiveSuite = testFiles && testFiles.length > 0 ? `files:${testFiles.length}` : suite;

  const run = {
    process: null as ReturnType<typeof spawn> | null,
    logs: [] as string[],
    done: false,
    exitCode: null as number | null,
    startedAt: new Date().toISOString(),
    suite: effectiveSuite,
    env,
  };

  activeRuns.set(runId, run as typeof run & { process: ReturnType<typeof spawn> });

  // ── Async: pre-flight checks rồi mới chạy test ─────────────────────────────
  (async () => {
    // 1. Kiểm tra session auth
    // Thử session theo env trước, fallback về session.json chung
    const sessionFileEnv = path.join(projectRoot, ".auth", env === "staging" ? "session.staging.json" : env === "prod" ? "session.prod.json" : "session.json");
    const sessionFileFallback = path.join(projectRoot, ".auth", "session.json");

    const activeSession = fs.existsSync(sessionFileEnv) ? sessionFileEnv
      : fs.existsSync(sessionFileFallback) ? sessionFileFallback
      : null;

    if (!activeSession) {
      logStep(run, `❌ Shopify session không tìm thấy`);
      logStep(run, `→ Chạy: npm run auth`);
      run.done = true; run.exitCode = 1; return;
    }

    // Kiểm tra session còn hợp lệ không (Shopify cookies thường hết hạn sau vài ngày)
    const sessionAge = Date.now() - fs.statSync(activeSession).mtimeMs;
    const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
    const sessionAgeHours = Math.floor(sessionAge / 3600000);

    if (sessionAge > SESSION_MAX_AGE_MS) {
      logStep(run, `❌ Session ${path.basename(activeSession)} đã quá cũ (${Math.floor(sessionAge / 86400000)} ngày)`);
      logStep(run, `→ Chạy: npm run auth:reset && npm run auth`);
      run.done = true; run.exitCode = 1; return;
    }

    if (activeSession !== sessionFileEnv && env !== "local") {
      logStep(run, `⚠️  Dùng session.json chung (${sessionAgeHours}h tuổi) — không có session riêng cho ${env}`);
    } else {
      logStep(run, `✅ Session: ${path.basename(activeSession)} (${sessionAgeHours}h tuổi)`);
    }

    // 2. Kiểm tra store handle
    const storeHandle = envVars.STORE_HANDLE || "";
    if (!storeHandle) {
      logStep(run, `❌ STORE_HANDLE chưa set trong .env`);
      logStep(run, `→ Điền STORE_HANDLE=ten-store vào .env rồi thử lại`);
      run.done = true; run.exitCode = 1; return;
    }
    logStep(run, `🏪 Store: ${storeHandle}`);

    // 3. Kiểm tra app handles + block nếu app đang test chưa có handle
    const appKeyMap: Record<string, string> = { avadaPlaza: "AVADA_PLAZA", seo: "SEO", blogs: "BLOGS" };
    let targetHandleMissing = false;

    for (const key of ["avadaPlaza", "seo", "blogs"]) {
      const prefix = appKeyMap[key];
      const envKey = env === "staging" && stageNum
        ? `STAGING_${stageNum}_${prefix}_HANDLE`
        : `${prefix}_HANDLE`;
      const handle = envVars[envKey] || "";
      const isTarget = key === appKey;

      if (isTarget && !handle) {
        logStep(run, `❌ ${key} handle chưa set [${envKey}]`);
        logStep(run, `→ Điền ${envKey}=... vào .env rồi thử lại`);
        targetHandleMissing = true;
      } else if (handle) {
        logStep(run, `${isTarget ? "🎯" : "✅"} ${key}: ${handle} [${envKey}]`);
      } else {
        logStep(run, `⚪ ${key}: (chưa set) [${envKey}]`);
      }
    }

    if (targetHandleMissing) {
      run.done = true; run.exitCode = 1; return;
    }

    // 3. Verify staging deploy (nếu có mrUrl + stageNum)
    if (env === "staging" && mrUrl && stageNum && expectedBranch) {
      logStep(run, `🔍 Kiểm tra staging ${stageNum} — đang query GitLab deployments...`);
      try {
        const gitlabToken = process.env.GITLAB_TOKEN;
        const gitlabUrl = process.env.GITLAB_URL || "https://gitlab.com";
        const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
        if (match && gitlabToken) {
          const projectPath = encodeURIComponent(match[1]);
          const envName = process.env[`STAGING_${stageNum}_ENV_NAME`] || `staging-${stageNum}`;
          const res = await fetch(
            `${gitlabUrl}/api/v4/projects/${projectPath}/deployments?environment=${envName}&order_by=created_at&sort=desc&per_page=1`,
            { headers: { "PRIVATE-TOKEN": gitlabToken }, signal: AbortSignal.timeout(5000) }
          );
          if (res.ok) {
            const deployments = await res.json() as Array<{ ref: string; status: string; created_at: string }>;
            if (deployments.length > 0) {
              const latest = deployments[0];
              const deployedBranch = latest.ref;
              if (deployedBranch === expectedBranch) {
                logStep(run, `✅ Staging ${stageNum} (${envName}): deploy đúng branch "${deployedBranch}"`);
              } else {
                logStep(run, `⚠️  Staging ${stageNum} (${envName}): đang deploy "${deployedBranch}" (cần "${expectedBranch}")`);
              }
            } else {
              logStep(run, `❓ Staging ${stageNum}: không tìm thấy deployment — tiếp tục`);
            }
          }
        }
      } catch {
        logStep(run, `⚠️  Không query được GitLab staging info — tiếp tục`);
      }
    }

    // 4. Kiểm tra test files tồn tại
    if (testFiles && testFiles.length > 0) {
      const missing = testFiles.filter(f => !fs.existsSync(path.join(projectRoot, f)));
      if (missing.length > 0) {
        logStep(run, `❌ Test files không tồn tại: ${missing.join(", ")}`);
        logStep(run, `ℹ️  Sẽ chạy toàn bộ suite "${suite}" thay thế`);
      } else {
        logStep(run, `✅ Test files: ${testFiles.join(", ")}`);
      }
    }

    // 5. Build command
    let args: string[];
    const validTestFiles = (testFiles || []).filter(f => fs.existsSync(path.join(projectRoot, f)));
    if (validTestFiles.length > 0) {
      args = ["npx", "playwright", "test", "--project=chromium", ...validTestFiles];
      logStep(run, `▶ Chạy ${validTestFiles.length} test file(s) vừa gen`);
    } else {
      args = [...(SUITE_COMMANDS[suite] || SUITE_COMMANDS.all)];
      logStep(run, `▶ Chạy toàn bộ suite: ${suite}`);
    }
    if (headed) args.push("--headed");

    logStep(run, `🎭 Playwright: ${args.slice(1).join(" ")}`);

    // 6. Spawn Playwright
    const child = spawn(args[0], args.slice(1), {
      cwd: projectRoot,
      env: envVars,
      shell: true,
    });

    (run as typeof run & { process: ReturnType<typeof spawn> }).process = child;

    const processLine = (line: string) => {
      if (!line.trim()) return;
      let prefixed = line;

      // Match ONLY Playwright test result lines — not stack traces or error messages.
      // Playwright reporter formats:
      //   PASS: "  ✓ 1 [chromium] › ..."  or "X passed"
      //   FAIL: "  ✘ 1 [chromium] › ..."  or "  1) [chromium] › ..."
      //   SKIP: "  - 1 [chromium] › ..."  or "X skipped"
      const isTestResultPass =
        /^\s*✓/.test(line) ||                        // ✓ per-test result
        /^\d+\s+passed/.test(line.trim());            // "6 passed" summary line

      const isTestResultFail =
        /^\s*[✗✘]/.test(line) ||                     // ✘ per-test result
        /^\s+\d+\)\s+\[/.test(line);                 // "  1) [chromium] › ..." numbered fail

      const isTestResultSkip =
        /^\s*-\s+\d+\s+\[/.test(line) ||             // "  - 1 [chromium] › ..."
        /^\d+\s+skipped/.test(line.trim());           // "X skipped" summary line

      if (isTestResultPass) {
        prefixed = `PASS: ${line}`;
      } else if (isTestResultFail) {
        prefixed = `FAIL: ${line}`;
      } else if (isTestResultSkip) {
        prefixed = `SKIP: ${line}`;
      }

      run.logs.push(prefixed);
    };

    child.stdout?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach(processLine);
    });
    child.stderr?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach(processLine);
    });

    child.on("close", (code) => {
      run.done = true;
      run.exitCode = code;

      const passed = run.logs.filter((l) => l.startsWith("PASS:")).length;
      const failed = run.logs.filter((l) => l.startsWith("FAIL:")).length;

      logStep(run, `${failed === 0 ? "✅" : "❌"} Kết quả: ${passed} passed, ${failed} failed`);

      // Save history
      const historyPath = path.join(DATA_DIR, "history.json");
      let history = { runs: [] as Record<string, unknown>[] };
      try {
        if (fs.existsSync(historyPath)) history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      } catch { /* ignore */ }

      history.runs.unshift({
        id: runId, suite: run.suite, env: run.env,
        startedAt: run.startedAt,
        duration: Date.now() - new Date(run.startedAt).getTime(),
        passed, failed, total: passed + failed,
        status: failed === 0 && code === 0 ? "passed" : "failed",
      });
      history.runs = history.runs.slice(0, 100);
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      } catch { /* ignore */ }

      setTimeout(() => activeRuns.delete(runId), 5 * 60 * 1000);
    });
  })();

  return NextResponse.json({ runId });
}
