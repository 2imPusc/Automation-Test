/**
 * POST /api/record   — start/stop Playwright codegen session
 * GET  /api/record   — list recorded features
 */
import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const PROJECT_ROOT = path.join(os.homedir(), "shopify-autotest");
const FEATURES_DIR = path.join(PROJECT_ROOT, "recorded-features");
const AUTH_FILE = path.join(PROJECT_ROOT, ".auth", "session.json");

// In-memory: active recording session
interface RecordSession {
  id: string;
  app: string;
  appHandle: string;
  storeHandle: string;
  testName: string;
  featureName: string;
  startedAt: string;
  outputFile: string;
  process: ChildProcess | null;
  code: string;
  done: boolean;
  pid?: number;
}

const sessions = new Map<string, RecordSession>();
(globalThis as Record<string, unknown>).__recordSessions = sessions;

function readEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const idx = t.indexOf("=");
      if (idx < 0) continue;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[k] = v;
    }
  } catch { /* ignore */ }
  return env;
}

export async function GET() {
  fs.mkdirSync(FEATURES_DIR, { recursive: true });

  // List feature files
  const features: Array<{
    name: string;
    file: string;
    app: string;
    testCount: number;
    updatedAt: string;
  }> = [];

  if (fs.existsSync(FEATURES_DIR)) {
    for (const fname of fs.readdirSync(FEATURES_DIR)) {
      if (!fname.endsWith(".spec.ts")) continue;
      const fpath = path.join(FEATURES_DIR, fname);
      const content = fs.readFileSync(fpath, "utf-8");
      const stat = fs.statSync(fpath);
      const testMatches = content.match(/\btest\s*\(/g) || [];
      const appMatch = content.match(/@app\s+(.+)/);
      features.push({
        name: fname.replace(".spec.ts", ""),
        file: path.relative(PROJECT_ROOT, fpath),
        app: appMatch?.[1]?.trim() ?? "unknown",
        testCount: testMatches.length,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }

  // Active session
  const active = Array.from(sessions.values())
    .filter(s => !s.done)
    .map(s => ({ id: s.id, app: s.app, testName: s.testName, featureName: s.featureName, startedAt: s.startedAt }));

  return NextResponse.json({ features, active });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action: "start" | "stop" | "save" | "delete";
    // start
    app?: string;
    testName?: string;
    featureName?: string;
    // stop/save/delete
    sessionId?: string;
    featureFile?: string;
  };

  const { action } = body;

  // ── START ────────────────────────────────────────────────────────────────
  if (action === "start") {
    const { app = "avadaPlaza", testName = "New test", featureName = "untitled-feature" } = body;

    const envVars = readEnv();
    const storeHandle = envVars.STORE_HANDLE || "dophuc-store";

    const appHandleMap: Record<string, string> = {
      avadaPlaza: envVars.AVADA_PLAZA_HANDLE || "",
      seo: envVars.SEO_HANDLE || "",
      blogs: envVars.BLOGS_HANDLE || "",
    };
    const appHandle = appHandleMap[app] || appHandleMap.avadaPlaza;

    if (!appHandle) {
      return NextResponse.json({ error: `App handle not set for: ${app}` }, { status: 400 });
    }

    const sessionId = crypto.randomUUID();
    const outputFile = path.join(os.tmpdir(), `codegen-${sessionId}.ts`);

    // URL to record from — app embed page
    const startUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${appHandle}/embed`;

    // Spawn playwright codegen
    const child = spawn(
      "npx", [
        "playwright", "codegen",
        "--load-storage", AUTH_FILE,
        "--output", outputFile,
        "--target", "playwright-test",
        startUrl,
      ],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...Object.fromEntries(
          Object.entries(envVars).filter(([k]) => !process.env[k])
        )},
        detached: false,
        shell: true,
      }
    );

    const session: RecordSession = {
      id: sessionId,
      app,
      appHandle,
      storeHandle,
      testName,
      featureName: featureName.toLowerCase().replace(/\s+/g, "-"),
      startedAt: new Date().toISOString(),
      outputFile,
      process: child,
      code: "",
      done: false,
      pid: child.pid,
    };

    sessions.set(sessionId, session);

    child.on("close", () => {
      session.done = true;
      session.process = null;
      // Read generated code if output file exists
      if (fs.existsSync(outputFile)) {
        session.code = fs.readFileSync(outputFile, "utf-8");
      }
    });

    return NextResponse.json({
      sessionId,
      message: `Playwright Codegen đã mở — thực hiện thao tác trên browser, rồi nhấn Stop khi xong.`,
      startUrl,
    });
  }

  // ── STOP ─────────────────────────────────────────────────────────────────
  if (action === "stop") {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const session = sessions.get(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Kill codegen process
    if (session.process && !session.done) {
      try {
        session.process.kill("SIGTERM");
        // Give it time to write output file
        await new Promise(r => setTimeout(r, 1500));
      } catch { /* ignore */ }
    }

    session.done = true;

    // Read generated code
    if (fs.existsSync(session.outputFile)) {
      session.code = fs.readFileSync(session.outputFile, "utf-8");
    }

    return NextResponse.json({
      sessionId,
      code: session.code,
      hasCode: session.code.length > 0,
    });
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  if (action === "save") {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const session = sessions.get(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (!session.code) {
      return NextResponse.json({ error: "Không có code để lưu — hãy Stop trước." }, { status: 400 });
    }

    fs.mkdirSync(FEATURES_DIR, { recursive: true });

    const featureFile = path.join(FEATURES_DIR, `${session.featureName}.spec.ts`);
    const testCode = buildTestCase(session);

    if (fs.existsSync(featureFile)) {
      // Append test into existing feature file
      appendTestToFeature(featureFile, testCode, session.testName);
    } else {
      // Create new feature file
      const content = buildFeatureFile(session, testCode);
      fs.writeFileSync(featureFile, content, "utf-8");
    }

    // Cleanup tmp file
    try { fs.unlinkSync(session.outputFile); } catch { /* ignore */ }
    sessions.delete(sessionId);

    const relPath = path.relative(PROJECT_ROOT, featureFile);
    return NextResponse.json({ saved: true, featureFile: relPath });
  }

  // ── DELETE feature ────────────────────────────────────────────────────────
  if (action === "delete") {
    const { featureFile } = body;
    if (!featureFile) return NextResponse.json({ error: "featureFile required" }, { status: 400 });

    const absPath = path.resolve(PROJECT_ROOT, featureFile);
    if (!absPath.startsWith(FEATURES_DIR)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
    }

    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildTestCase(session: RecordSession): string {
  // Extract the test body from codegen output
  // Playwright codegen outputs: test('...', async ({ page }) => { ... })
  // We need to adapt it to use our fixtures + iframe
  const raw = session.code;

  // Extract actions between first { and last }
  const bodyMatch = raw.match(/async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{([\s\S]*)\}\s*\)/);
  const body = bodyMatch?.[1]?.trim() ?? raw;

  // Replace page.goto with comment (fixture handles navigation)
  const cleanedBody = body
    .replace(/await page\.goto\([^)]+\);\n?/g, "  // Navigation handled by fixture\n")
    .replace(/page\./g, "imageManager.page.")
    .trim();

  return `
  /**
   * ${session.testName}
   * @recorded ${new Date().toISOString()}
   */
  test('${session.testName}', async ({ imageManager }) => {
    await imageManager.waitForLoad();
${cleanedBody.split("\n").map(l => "    " + l).join("\n")}
  });`;
}

function buildFeatureFile(session: RecordSession, testCode: string): string {
  const appNameMap: Record<string, string> = {
    avadaPlaza: "Avada Plaza",
    seo: "SEO Suite",
    blogs: "Blogs",
  };

  return `/**
 * @feature ${session.featureName}
 * @app ${appNameMap[session.app] ?? session.app}
 * @recorded Tester-recorded feature tests
 * @created ${new Date().toISOString()}
 *
 * Tests recorded via Playwright Codegen in Autotest Web UI.
 * Each test case was recorded manually by a tester.
 */
import { test, expect } from '../fixtures';
import { t, tLoc } from '../helpers/locale';

test.describe('${session.featureName}', () => {
${testCode}
});
`;
}

function appendTestToFeature(featureFile: string, testCode: string, testName: string): void {
  let content = fs.readFileSync(featureFile, "utf-8");

  // Check duplicate
  if (content.includes(`test('${testName}'`)) {
    const ts = Date.now();
    testCode = testCode.replace(`test('${testName}'`, `test('${testName} (${ts})'`);
  }

  // Insert before closing });
  const lastBrace = content.lastIndexOf("});");
  if (lastBrace >= 0) {
    content = content.slice(0, lastBrace) + testCode + "\n});\n";
  } else {
    content += testCode;
  }

  fs.writeFileSync(featureFile, content, "utf-8");
}
