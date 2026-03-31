import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawnSync, spawn as spawnAsync } from "child_process";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ManualInput {
  app: string;
  branch: string;
  title: string;
  description: string;
  bugs?: string;
}

export interface PipelineInput {
  notionUrl?: string;
  manualInput?: ManualInput;
  env?: "staging" | "local" | "prod";
  stageNum?: number;
  headed?: boolean;
}

export interface Scenario {
  name: string;
  description?: string;
  type: "regression" | "smoke" | "guard" | "edge-case";
  priority: "high" | "medium" | "low";
  steps: string[];
  assertions: string[];
  needsSourceFiles: string[];
  tags?: string[];
}

export interface FlowPlan {
  targetPage: string;
  featureFile: string;
  scenarios: Scenario[];
  pomAction: "create" | "extend" | "reuse";
  existingPom: string | null;
  notes?: string;
}

export interface PipelineContext {
  notion: {
    pageId: string;
    title: string;
    description: string;
    app: string;
    mr: string;
    bugs: string;
  };
  gitlab: {
    branch: string;
    diffSummary: string;
    diffFiles: string[];
    mrTitle: string;
    mrDescription: string;
  };
  context: {
    overview: string;
    featureFile: string;
    featureFileName: string;
    sourceFiles: Record<string, string>;
    sourceFileNames: string[];
  };
  snapshots: string | null;
  productSpec: {
    buttons: string[];
    toasts: string[];
    flows: Array<{ title: string; steps: string[] }>;
    edgeCases: string[];
    summary: string;
    specFile: string;
  } | null;
  meta: {
    app: string;
    appKey: string;
    appName: string;
    branch: string;
    commit: string;
    env: "staging" | "local" | "prod";
    stageNum?: number;
    contextDir: string;
    taskId: string;
    resolvedHandles: Record<string, string>;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PROJECT_ROOT = path.join(os.homedir(), "shopify-autotest");
export const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");
export const PROMPTS_DIR = path.join(PROJECT_ROOT, "skills/shopify-test-gen/prompts");

// ── Helpers ──────────────────────────────────────────────────────────────────

export function callScript<T>(script: string, fnCall: string): T {
  const code = `
    const m = require(${JSON.stringify(path.join(SCRIPTS_DIR, script))});
    const result = ${fnCall};
    if (result && typeof result.then === 'function') {
      result.then(r => { process.stdout.write(JSON.stringify(r)); process.exit(0); })
            .catch(e => { process.stderr.write(String(e)); process.exit(1); });
    } else {
      process.stdout.write(JSON.stringify(result));
    }
  `;
  const r = spawnSync("node", ["-e", code], {
    cwd: PROJECT_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf-8",
    timeout: 60_000,
    env: { ...process.env },
  });
  if (r.status !== 0) throw new Error(r.stderr || `Script ${script} failed`);
  const stdout = (r.stdout || "").trim();
  const jsonStart = stdout.lastIndexOf("\n{");
  const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart + 1) : stdout;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const match = stdout.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
    if (match) return JSON.parse(match[1]) as T;
    throw new Error(`Cannot parse output from ${script}: ${stdout.slice(0, 200)}`);
  }
}

export function expandHome(p: string) {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

export function resolveHandles(
  env: "staging" | "local" | "prod",
  stageNum?: number
): Record<string, string> {
  const APP_PREFIXES = ["AVADA_PLAZA", "SEO", "BLOGS"];
  const envVars: Record<string, string> = {};

  const dotenvPath = path.join(PROJECT_ROOT, ".env");
  const projectEnv: Record<string, string> = {};
  if (fs.existsSync(dotenvPath)) {
    const lines = fs.readFileSync(dotenvPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (match) projectEnv[match[1]] = match[2].trim();
    }
  }

  if (env === "staging" && stageNum) {
    envVars.ENV = "staging";
    for (const prefix of APP_PREFIXES) {
      const stagingKey = `STAGING_${stageNum}_${prefix}_HANDLE`;
      const handle = projectEnv[stagingKey] || process.env[stagingKey] || "";
      envVars[`STAGING_${prefix}_HANDLE`] = handle;
      envVars[stagingKey] = handle;
    }
  } else if (env === "prod") {
    envVars.ENV = "prod";
    for (const prefix of APP_PREFIXES) {
      const key = `${prefix}_HANDLE`;
      envVars[key] = projectEnv[key] || process.env[key] || "";
    }
  }

  envVars.STORE_HANDLE = projectEnv.STORE_HANDLE || process.env.STORE_HANDLE || "";
  return envVars;
}

export function resolveAppKey(app: string): string {
  const lower = app.toLowerCase();
  if (lower.includes("plaza") || lower.includes("image")) return "avadaPlaza";
  if (lower.includes("seo")) return "seo";
  if (lower.includes("blog")) return "blogs";
  return "avadaPlaza";
}

export function appKeyToFolder(appKey: string): string {
  if (appKey === "avadaPlaza") return "avada-plaza";
  return appKey;
}

export function sseEncode(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, ...((typeof data === "string") ? { text: data } : data as object) })}\n\n`;
}

export function extractTaskId(pageId: string): string {
  return pageId.replace(/-/g, "").slice(0, 8);
}

export function buildSpecFileName(featureName: string, taskId: string): string {
  const feature = featureName.replace(/\.md$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${feature}-${taskId}.spec.ts`;
}

export function buildMetadataHeader(ctx: PipelineContext, plan: FlowPlan): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  return [
    "/**",
    ` * @generated AI Pipeline — ${now}`,
    ` * @notion ${ctx.notion.mr ? "" : "N/A"}`,
    ` * @task ${ctx.notion.title}`,
    ` * @taskId ${ctx.notion.pageId}`,
    ` * @app ${ctx.meta.appName} (${ctx.meta.appKey})`,
    ` * @branch ${ctx.meta.branch}`,
    ` * @feature ${ctx.context.featureFileName}`,
    ` * @scenarios ${plan.scenarios.length}`,
    ` *`,
    ` * This file was auto-generated. It can be re-run on any environment`,
    ` * (local, staging, prod) — handles are resolved at runtime via helpers/apps.ts.`,
    " */",
  ].join("\n");
}

// ── Layer 1: Context Collector ──────────────────────────────────────────────

export async function collectContext(
  input: PipelineInput,
  stream: (msg: string) => void
): Promise<PipelineContext> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3100";

  let notion: { pageId: string; title: string; description: string; app: string; bugs: string; mr: string };

  if (input.manualInput) {
    stream(sseEncode("step", "✏️ Manual input — bỏ qua Notion..."));
    notion = {
      pageId: "",
      title: input.manualInput.title,
      description: input.manualInput.description,
      app: input.manualInput.app,
      bugs: input.manualInput.bugs || "",
      mr: "",
    };
    stream(sseEncode("step", `✅ Manual: "${notion.title}" (${notion.app})`));
  } else {
    stream(sseEncode("step", "📝 Đang đọc Notion task..."));
    const notionRes = await fetch(`${baseUrl}/api/smart/parse-notion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notionUrl: input.notionUrl }),
    });
    const notionData = await notionRes.json();
    if (!notionRes.ok) throw new Error(`Notion parse failed: ${notionData.error}`);
    notion = notionData;
    stream(sseEncode("step", `✅ Notion: "${notion.title}" (${notion.app})`));
  }

  const appKey = resolveAppKey(notion.app || "");
  const appFolder = appKeyToFolder(appKey);

  let gitlab = {
    branch: "master",
    diffSummary: "",
    diffFiles: [] as string[],
    mrTitle: "",
    mrDescription: "",
  };

  if (input.manualInput?.branch) {
    gitlab.branch = input.manualInput.branch;
    stream(sseEncode("step", `✅ Branch: "${gitlab.branch}" (manual)`));
  }

  const mrUrl = notion.mr || (notion as { gitlabInfo?: { mrUrl?: string } }).gitlabInfo?.mrUrl;
  if (!input.manualInput && mrUrl && !mrUrl.includes("isMock")) {
    stream(sseEncode("step", "🔀 Đang đọc GitLab MR..."));

    const gitlabRes = await fetch(`${baseUrl}/api/smart/parse-gitlab`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mrContent: mrUrl }),
    });
    const gitlabData = await gitlabRes.json();

    if (!gitlabData.isMock) {
      const rawDiffs = gitlabData.diff
        ? gitlabData.diff.split(/\/\/ /).filter(Boolean).map((chunk: string) => {
            const lines = chunk.split("\n");
            const filePath = lines[0]?.trim() || "";
            return { new_path: filePath, diff: lines.slice(1).join("\n") };
          })
        : [];

      const diffResult = callScript<{ summary: string; filesChanged: string[]; keyChanges: string[] }>(
        "diff-summary.js",
        `m.summarizeDiff(${JSON.stringify(rawDiffs)})`
      );

      gitlab = {
        branch: gitlabData.branch || "master",
        diffSummary: diffResult.summary,
        diffFiles: diffResult.filesChanged,
        mrTitle: gitlabData.title || "",
        mrDescription: gitlabData.description || "",
      };

      stream(sseEncode("step", `✅ GitLab: branch "${gitlab.branch}" — ${gitlab.diffFiles.length} files changed`));
    }
  }

  stream(sseEncode("step", "🔄 Syncing app context..."));

  const registry = callScript<Record<string, { name: string; repoPath: string; srcPath: string; localePath: string; testDir: string; contextDir: string }>>(
    "context-sync.js",
    "m.readRegistry()"
  );
  const app = registry[appKey];

  let contextDir = "";
  let commit = "";

  if (app) {
    try {
      const syncResult = callScript<{ upToDate: boolean; updated: boolean; contextDir: string; partial?: boolean; error?: string }>(
        "context-sync.js",
        `m.checkAndSync(${JSON.stringify(appKey)}, ${JSON.stringify(gitlab.branch)}, ${JSON.stringify(mrUrl || null)})`
      );
      contextDir = syncResult.contextDir;

      if (syncResult.error) {
        stream(sseEncode("warn", `⚠️ Context sync: ${syncResult.error}`));
      } else if (syncResult.updated) {
        stream(sseEncode("step", "✅ Context re-extracted (code updated)"));
      } else {
        stream(sseEncode("step", "✅ Context up-to-date"));
      }

      try {
        const repoPath = expandHome(app.repoPath);
        commit = execSync("git rev-parse --short HEAD", { cwd: repoPath, stdio: "pipe" }).toString().trim();
      } catch { /* ignore */ }
    } catch (err) {
      stream(sseEncode("warn", `⚠️ Context sync failed: ${err}`));
    }
  }

  stream(sseEncode("step", "📄 Loading feature context..."));

  const contextPath = contextDir || path.join(PROJECT_ROOT, `skills/shopify-test-gen/references/app-context/${appFolder}`);
  const overviewPath = path.join(contextPath, "_overview.md");
  let overview = "";
  let featureFile = "";
  let featureFileName = "";

  if (fs.existsSync(overviewPath)) {
    overview = fs.readFileSync(overviewPath, "utf-8");

    const allMdFiles = fs.readdirSync(contextPath)
      .filter(f => f.endsWith(".md") && f !== "_overview.md");
    const curatedFiles = allMdFiles.filter(f => !f.endsWith(".scanned.md"));
    const scannedFiles = allMdFiles.filter(f => f.endsWith(".scanned.md"));

    const featureFiles = curatedFiles.length > 0 ? curatedFiles : scannedFiles;

    let bestMatch = "";
    if (gitlab.diffFiles.length) {
      const diffPathsLower = gitlab.diffFiles.map(f => f.toLowerCase()).join(" ");
      let bestDiffScore = 0;
      for (const file of featureFiles) {
        const keywords = file.replace(".md", "").split("-");
        const score = keywords.filter(w => diffPathsLower.includes(w)).length;
        if (score > bestDiffScore) { bestDiffScore = score; bestMatch = file; }
      }
    }

    if (!bestMatch) {
      const descLower = (notion.title + " " + gitlab.mrTitle).toLowerCase();
      let bestScore = 0;
      for (const file of featureFiles) {
        const name = file.replace(".md", "").replace(/-/g, " ");
        const score = name.split(" ").filter(w => descLower.includes(w)).length;
        if (score > bestScore) { bestScore = score; bestMatch = file; }
      }
    }

    if (!bestMatch && featureFiles.length) bestMatch = featureFiles[0];

    // Phase 2 fallback: nếu không có curated feature file → dùng product spec làm feature context tạm
    if (!bestMatch && featureFiles.length === 0) {
      stream(sseEncode("warn", `⚠️ Không có feature context file — sẽ dùng product spec làm fallback`));
    }

    if (bestMatch) {
      featureFileName = bestMatch;
      featureFile = fs.readFileSync(path.join(contextPath, bestMatch), "utf-8");
      stream(sseEncode("step", `📄 Feature context: ${bestMatch}`));

      if (!bestMatch.endsWith(".scanned.md")) {
        const scannedCounterpart = bestMatch.replace(".md", ".scanned.md");
        const scannedPath = path.join(contextPath, scannedCounterpart);
        if (fs.existsSync(scannedPath)) {
          const scannedContent = fs.readFileSync(scannedPath, "utf-8");
          featureFile += `\n\n---\n<!-- Auto-scanned supplement (${scannedCounterpart}) -->\n${scannedContent}`;
          stream(sseEncode("step", `📄 Scanned supplement: ${scannedCounterpart}`));
        }
      }
    }
  }

  let sourceFiles: Record<string, string> = {};
  if (featureFileName && app) {
    try {
      sourceFiles = callScript<Record<string, string>>(
        "source-loader.js",
        `m.loadSourceFiles(${JSON.stringify(path.join(contextPath, featureFileName))}, ${JSON.stringify(expandHome(app.repoPath))}, { maxLinesPerFile: 200, maxTotalFiles: 10 })`
      );
      stream(sseEncode("step", `📦 Source files loaded: ${Object.keys(sourceFiles).length} files`));
    } catch (err) {
      stream(sseEncode("warn", `⚠️ Source loader: ${err}`));
    }
  }

  let snapshots: string | null = null;
  const snapshotIndex = path.join(PROJECT_ROOT, "snapshots/index.json");
  if (fs.existsSync(snapshotIndex)) {
    try {
      const index = JSON.parse(fs.readFileSync(snapshotIndex, "utf-8"));
      const snaps = (index.snapshots || []).filter((s: { app: string }) => s.app === appKey);
      if (snaps.length) {
        const sections = snaps.map((snap: { app: string; page: string; json: string }) => {
          const jsonPath = path.join(PROJECT_ROOT, snap.json);
          if (!fs.existsSync(jsonPath)) return "";
          const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
          const dom = data.dom || {};
          const lines = [`### Snapshot: ${snap.app}/${snap.page}`];
          if (dom.buttons?.length) lines.push(`Buttons: ${dom.buttons.slice(0, 10).map((b: { text: string }) => b.text).join(", ")}`);
          if (dom.links?.length) lines.push(`Links: ${dom.links.join(", ")}`);
          return lines.join("\n");
        }).filter(Boolean);
        if (sections.length) snapshots = sections.join("\n---\n");
      }
    } catch { /* ignore */ }
  }

  // ── Product Spec (Phase 1 upgrade) ──────────────────────────────────────────
  let productSpec: PipelineContext["productSpec"] = null;
  if (featureFileName) {
    try {
      stream(sseEncode("step", "📋 Fetching product spec..."));
      const { fetchProductSpec } = require(path.join(SCRIPTS_DIR, "product-spec-fetcher.js"));
      const spec = await fetchProductSpec(appKey, featureFileName);
      if (spec) {
        productSpec = spec;
        const summary = [
          spec.buttons.length ? `${spec.buttons.length} buttons` : "",
          spec.toasts.length ? `${spec.toasts.length} toasts` : "",
          spec.flows.length ? `${spec.flows.length} flows` : "",
        ].filter(Boolean).join(", ");
        stream(sseEncode("step", `✅ Product spec loaded: ${summary || "spec found"} (${path.basename(spec.specFile)})`));

        // Phase 2 fallback: nếu không có feature context, dùng product spec rawSpec
        if (!featureFile && spec.rawSpec) {
          featureFile = `<!-- Fallback: generated from product spec (${path.basename(spec.specFile)}) -->\n\n${spec.rawSpec}`;
          featureFileName = featureFileName || `${appKey}-product-spec.md`;
          stream(sseEncode("step", `📄 Feature context fallback: product spec (${path.basename(spec.specFile)})`));
        }
      } else {
        stream(sseEncode("step", "ℹ️ Product spec: không có spec cho feature này"));
      }
    } catch (err) {
      stream(sseEncode("warn", `⚠️ Product spec fetch failed: ${err}`));
    }
  }

  const appName = app?.name || notion.app || "Unknown";

  return {
    notion: {
      pageId: notion.pageId,
      title: notion.title,
      description: notion.description,
      app: notion.app,
      mr: mrUrl || "",
      bugs: notion.bugs,
    },
    gitlab,
    context: {
      overview,
      featureFile,
      featureFileName,
      sourceFiles,
      sourceFileNames: Object.keys(sourceFiles).map(f => path.basename(f)),
    },
    snapshots,
    productSpec,
    meta: {
      app: notion.app,
      appKey,
      appName,
      branch: gitlab.branch,
      commit,
      env: input.env || "local",
      stageNum: input.stageNum,
      taskId: extractTaskId(notion.pageId),
      contextDir: contextPath,
      resolvedHandles: resolveHandles(input.env || "local", input.stageNum),
    },
  };
}

// ── Layer 2: Flow Planner ───────────────────────────────────────────────────

export async function planFlow(
  ctx: PipelineContext,
  stream: (msg: string) => void
): Promise<FlowPlan> {
  stream(sseEncode("step", "🧠 Layer 2: AI đang phân tích flow..."));

  const promptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, "flow-planner.md"), "utf-8");

  let featureForPlanner = "";
  if (ctx.context.featureFile) {
    const maxLen = 3000;
    if (ctx.context.featureFile.length <= maxLen) {
      featureForPlanner = ctx.context.featureFile;
    } else {
      const cutPoint = ctx.context.featureFile.lastIndexOf("\n## ", maxLen);
      featureForPlanner = cutPoint > 0
        ? ctx.context.featureFile.slice(0, cutPoint) + "\n<!-- truncated -->"
        : ctx.context.featureFile.slice(0, maxLen) + "\n<!-- truncated -->";
    }
  }

  const appFolder = appKeyToFolder(ctx.meta.appKey);
  const snapshotAvailable = ctx.snapshots !== null;
  const probeJsonPath = path.join(PROJECT_ROOT, `snapshots/probe-${appFolder}-${ctx.context.featureFileName.replace(".md", "")}.json`);
  const probeAvailable = fs.existsSync(probeJsonPath);
  const scannedAvailable = ctx.context.featureFileName
    ? fs.existsSync(path.join(ctx.meta.contextDir, ctx.context.featureFileName.replace(".md", ".scanned.md")))
    : false;

  const testDir = path.join(PROJECT_ROOT, `tests/${appFolder}`);
  let existingTests: string[] = [];
  if (fs.existsSync(testDir)) {
    existingTests = fs.readdirSync(testDir)
      .filter(f => f.endsWith(".spec.ts"));
  }

  // Phase 3: trim overview — chỉ giữ Pages table, bỏ Polaris selectors
  const overviewTrimmed = (() => {
    const overviewLines = ctx.context.overview.split("\n");
    const pagesStart = overviewLines.findIndex(l => l.includes("## Pages") || l.includes("| Nav"));
    const pagesEnd = overviewLines.findIndex((l, i) => i > pagesStart + 2 && l.startsWith("## "));
    if (pagesStart >= 0 && pagesEnd > pagesStart) {
      return overviewLines.slice(pagesStart, pagesEnd).join("\n");
    }
    return ctx.context.overview.slice(0, 800);
  })();

  // Phase 3: trim source file names — chỉ relevant files từ diff
  const relevantSourceFiles = ctx.gitlab.diffFiles.length
    ? ctx.gitlab.diffFiles
        .map(f => path.basename(f))
        .filter(f => ctx.context.sourceFileNames.includes(f))
        .slice(0, 5)
    : ctx.context.sourceFileNames.slice(0, 5);

  // Phase 1: product spec excerpt cho Flow Planner
  const productSpecSection = ctx.productSpec
    ? `## Product Spec (Ground Truth)
Source: ${path.basename(ctx.productSpec.specFile)}

${ctx.productSpec.summary}
`
    : "";

  const dataSection = `
---

## Description
${ctx.notion.title}
${ctx.notion.description}

## Bugs
${ctx.notion.bugs || "Chưa có bugs (task mới, autotest chạy trước)"}

## MR Info
Title: ${ctx.gitlab.mrTitle || "N/A"}
Description: ${ctx.gitlab.mrDescription || "N/A"}

## Diff Summary
${ctx.gitlab.diffSummary || "Không có diff info"}

## App Pages (overview)
${overviewTrimmed}

## Feature Context (${ctx.context.featureFileName})
${featureForPlanner || "Không có feature file"}

${productSpecSection}

## Source Files Available (relevant to this diff)
${relevantSourceFiles.join("\n") || "Không có source files"}

## Data Availability
- snapshotAvailable: ${snapshotAvailable}
- probeAvailable: ${probeAvailable}
- scannedAvailable: ${scannedAvailable}

## Existing Tests (avoid duplicates, ensure regression coverage)
${existingTests.length ? existingTests.map(f => `- ${f}`).join("\n") : "Chưa có test nào cho app này"}
`;

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (!gatewayToken) throw new Error("OPENCLAW_GATEWAY_TOKEN chưa set");

  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayToken}`,
      "x-openclaw-scopes": "operator.read,operator.write",
    },
    body: JSON.stringify({
      model: "openclaw:test-gen",
      max_tokens: 4096,
      messages: [
        { role: "system", content: promptTemplate },
        { role: "user", content: dataSection },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Flow Planner AI error: ${res.status} — ${txt}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*"scenarios"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Flow Planner không trả về JSON hợp lệ");
  }

  const plan: FlowPlan = JSON.parse(jsonMatch[0]);

  stream(sseEncode("step", `✅ Flow plan: ${plan.scenarios.length} scenarios cho "${plan.targetPage}"`));
  for (const s of plan.scenarios) {
    stream(sseEncode("scenario", { name: s.name, type: s.type, priority: s.priority, steps: s.steps.length }));
  }

  return plan;
}

// ── Layer 3: Code Writer ────────────────────────────────────────────────────

function runClaudeAsync(
  prompt: string,
  env: NodeJS.ProcessEnv,
  stream: (msg: string) => void,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const claudePath = process.env.CLAUDE_PATH || "/Users/avada/.local/bin/claude";
    const child = spawnAsync(claudePath, [
      "--permission-mode", "bypassPermissions",
      "--print",
    ], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...env,
        PATH: `${process.env.PATH}:/Users/avada/.local/bin:/usr/local/bin`,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (stdout.length % 2048 < text.length) {
        stream(sseEncode("step", `⏳ Claude writing... (${Math.round(stdout.length / 1024)}KB output)`));
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.stdin?.write(prompt);
    child.stdin?.end();

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      stream(sseEncode("warn", "⚠️ Claude Code timeout (180s) — killed"));
    }, 180_000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      stderr += String(err);
      resolve({ stdout, stderr, exitCode: -1 });
    });
  });
}

export async function writeCode(
  ctx: PipelineContext,
  plan: FlowPlan,
  stream: (msg: string) => void
): Promise<{ files: string[]; validated: boolean }> {
  stream(sseEncode("step", "✍️ Layer 3: AI đang viết test code..."));

  const taskId = extractTaskId(ctx.notion.pageId);
  const specFileName = buildSpecFileName(ctx.context.featureFileName, taskId);
  const appFolder = appKeyToFolder(ctx.meta.appKey);
  const specFilePath = `tests/${appFolder}/${specFileName}`;
  const metadataHeader = buildMetadataHeader(ctx, plan);

  stream(sseEncode("step", `📎 Target file: ${specFilePath}`));

  const allNeeded = Array.from(new Set(plan.scenarios.flatMap(s => s.needsSourceFiles)));
  const filteredSources = callScript<Record<string, string>>(
    "source-loader.js",
    `m.filterSourceFiles(${JSON.stringify(ctx.context.sourceFiles)}, ${JSON.stringify(allNeeded)})`
  );

  const patterns: Record<string, string> = {};
  const patternFiles = [
    "helpers/pages/BasePage.ts",
    "helpers/apps.ts",
    "helpers/shopify.ts",
    "fixtures/index.ts",
  ];

  if (plan.existingPom) {
    patternFiles.push(`helpers/pages/${plan.existingPom}`);
  }

  for (const f of patternFiles) {
    const p = path.join(PROJECT_ROOT, f);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      patterns[f] = content.length > 3000 ? content.slice(0, 3000) + "\n// ... truncated" : content;
    }
  }

  const promptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, "code-writer.md"), "utf-8");

  const polarisMapPath = path.join(PROJECT_ROOT, "skills/shopify-test-gen/references/polaris-playwright-map.md");
  const polarisMap = fs.existsSync(polarisMapPath) ? fs.readFileSync(polarisMapPath, "utf-8") : "";

  const sourceSection = Object.entries(filteredSources).length
    ? Object.entries(filteredSources).map(([name, content]) =>
        `### ${name}\n\`\`\`javascript\n${content}\n\`\`\``
      ).join("\n\n")
    : "Không có source files cần đọc — feature context đủ để viết test.";

  const patternSection = Object.entries(patterns)
    .map(([name, content]) => `### ${name}\n\`\`\`typescript\n${content}\n\`\`\``)
    .join("\n\n");

  // Phase 1: product spec section cho Code Writer
  const productSpecForWriter = ctx.productSpec
    ? `## Product Spec — Exact UI Text (use these verbatim)

> Source: ${path.basename(ctx.productSpec.specFile)}
> IMPORTANT: Use EXACT text from this spec for button names, toast messages, and labels.
> Do NOT infer or paraphrase — these are the actual strings rendered in the app.

${ctx.productSpec.summary}
`
    : "";

  const prompt = `${promptTemplate}

---

## IMPORTANT: File Naming & Metadata

The spec file MUST be saved as: \`${specFilePath}\`
The file MUST start with this metadata header:
\`\`\`typescript
${metadataHeader}
\`\`\`

## Test Plan (from Flow Planner)

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

## Feature Context (${ctx.context.featureFileName})

${ctx.context.featureFile}

${productSpecForWriter}

## Source Files (filtered for this task)

${sourceSection}

## Codebase Patterns

${patternSection}

${polarisMap ? `## Polaris ↔ Playwright Reference\n\n${polarisMap}` : ""}

${ctx.snapshots ? `## UI Snapshots\n${ctx.snapshots}` : ""}

## Meta

- App: ${ctx.meta.appName} (key: ${ctx.meta.appKey})
- Branch: ${ctx.meta.branch}
- Working directory: ${PROJECT_ROOT}
- Task ID: ${taskId}
- Notion Page: ${ctx.notion.pageId}
`;

  stream(sseEncode("step", "⏳ Claude Code đang viết files..."));

  const beforeFiles = new Map<string, number>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith(".spec.ts")) {
        const p = path.join(dir, entry.name);
        beforeFiles.set(p, fs.statSync(p).mtimeMs);
      }
    }
  };
  walk(path.join(PROJECT_ROOT, "tests"));
  const startTime = Date.now();

  const result = await runClaudeAsync(
    prompt,
    { ...process.env, ...ctx.meta.resolvedHandles },
    stream,
  );

  if (result.exitCode !== 0 || result.stderr) {
    stream(sseEncode("warn", `Claude exit=${result.exitCode}, stderr: ${result.stderr.slice(0, 200)}`));
  }
  if (result.stdout) {
    stream(sseEncode("step", `Claude output: ${result.stdout.length} chars`));
    stream(sseEncode("step", `Claude says: ${result.stdout.slice(0, 500)}`));
  }

  const touchedFiles: string[] = [];
  const walk2 = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk2(path.join(dir, entry.name));
      else if (entry.name.endsWith(".spec.ts")) {
        const p = path.join(dir, entry.name);
        const mtime = fs.statSync(p).mtimeMs;
        const wasNew = !beforeFiles.has(p);
        const wasModified = beforeFiles.has(p) && mtime > (beforeFiles.get(p) as number);
        if (wasNew || wasModified) touchedFiles.push(path.relative(PROJECT_ROOT, p));
      }
    }
  };
  walk2(path.join(PROJECT_ROOT, "tests"));

  const pomDir = path.join(PROJECT_ROOT, "helpers/pages");
  const touchedPoms: string[] = [];
  if (fs.existsSync(pomDir)) {
    for (const entry of fs.readdirSync(pomDir)) {
      if (entry.endsWith(".ts")) {
        const p = path.join(pomDir, entry);
        if (fs.statSync(p).mtimeMs >= startTime) {
          touchedPoms.push(path.relative(PROJECT_ROOT, p));
        }
      }
    }
  }
  if (touchedPoms.length) {
    stream(sseEncode("step", `📝 POM files touched: ${touchedPoms.join(", ")}`));
  }

  const createdFiles = touchedFiles;

  let validated = false;
  if (createdFiles.length) {
    stream(sseEncode("step", `📋 Created: ${createdFiles.join(", ")}`));

    const validateResult = spawnSync("npx", ["playwright", "test", "--list", ...createdFiles], {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      shell: true,
      encoding: "utf-8",
      timeout: 30_000,
    });
    validated = validateResult.status === 0;
    stream(sseEncode("step", validated ? "✅ Syntax validated" : "⚠️ Syntax validation failed"));
  } else {
    stream(sseEncode("warn", "⚠️ Claude Code không tạo file mới"));
  }

  return { files: createdFiles, validated };
}
