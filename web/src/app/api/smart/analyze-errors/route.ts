import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROJECT_ROOT = path.join(os.homedir(), "shopify-autotest");
const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");
const PROMPTS_DIR = path.join(PROJECT_ROOT, "skills/shopify-test-gen/prompts");

/** Map app folder → appKey for product spec fetcher */
function appFolderToKey(appFolder: string): string {
  if (appFolder === "avada-plaza") return "avadaPlaza";
  if (appFolder === "seo") return "seo";
  if (appFolder === "blogs") return "blogs";
  return appFolder;
}

/** Infer feature name từ test file name */
function inferFeatureName(testFile: string): string {
  // e.g. tests/seo/seo-checklist-abc123.spec.ts → seo-checklist
  const base = path.basename(testFile, ".spec.ts");
  return base.replace(/-[a-f0-9]{8}$/, ""); // strip taskId
}

/** Load product spec for failing test (Phase 4) */
async function loadProductSpecForTest(testFile: string): Promise<string> {
  try {
    const appMatch = testFile.match(/tests\/([^/]+)\//);
    if (!appMatch) return "";

    const appKey = appFolderToKey(appMatch[1]);
    const featureName = inferFeatureName(testFile);

    const { fetchProductSpec } = require(path.join(SCRIPTS_DIR, "product-spec-fetcher.js"));
    const spec = await fetchProductSpec(appKey, featureName);
    if (!spec) return "";

    return `## Product Spec — Ground Truth UI Text
Source: ${path.basename(spec.specFile)}

${spec.summary}

> Use this to determine if "element not found" errors are due to:
> - Text MATCHING spec → selector strategy is wrong (test bug)
> - Text NOT IN spec → app changed or feature removed (app bug)
`;
  } catch {
    return "";
  }
}

interface FailedTest {
  testName: string;
  errorMessage: string;
  testFile: string;
  /** Playwright test-results folder name */
  resultDir?: string;
  /** C1: Scenario description from Flow Planner (expected behavior) */
  scenarioDescription?: string;
}

interface AnalysisResult {
  testName: string;
  diagnosis: {
    category: string;
    summary: string;
    details: string;
    confidence: string;
  };
  rootCause: {
    isAppBug: boolean;
    isTestBug: boolean;
    isEnvIssue: boolean;
    explanation: string;
  };
  suggestions: Array<{
    action: string;
    description: string;
    code?: string;
  }>;
  evidence: string[];
  /** C3: Screenshot path for Web UI to display to tester */
  screenshotPath?: string | null;
}

/**
 * Read error context from test-results directory
 */
function loadErrorContext(resultDir: string): {
  errorContext: string;
  screenshotPath: string | null;
  hasVideo: boolean;
} {
  const fullPath = path.join(PROJECT_ROOT, "test-results", resultDir);
  let errorContext = "";
  let screenshotPath: string | null = null;
  let hasVideo = false;

  if (!fs.existsSync(fullPath)) {
    return { errorContext: "", screenshotPath: null, hasVideo: false };
  }

  // Read error-context.md (page snapshot DOM)
  const contextFile = path.join(fullPath, "error-context.md");
  if (fs.existsSync(contextFile)) {
    const content = fs.readFileSync(contextFile, "utf-8");
    // Truncate to ~4000 chars to manage context size
    errorContext = content.length > 4000
      ? content.slice(0, 4000) + "\n... (truncated)"
      : content;
  }

  // Find screenshot
  const files = fs.readdirSync(fullPath);
  const screenshot = files.find(f => f.endsWith(".png"));
  if (screenshot) {
    screenshotPath = path.join("test-results", resultDir, screenshot);
  }

  hasVideo = files.some(f => f.endsWith(".webm"));

  return { errorContext, screenshotPath, hasVideo };
}

/**
 * Read the test source code
 */
function loadTestCode(testFile: string, testName: string): string {
  const fullPath = path.join(PROJECT_ROOT, testFile);
  if (!fs.existsSync(fullPath)) return "";

  const content = fs.readFileSync(fullPath, "utf-8");
  // Try to extract just the relevant test block
  const lines = content.split("\n");
  const testIndex = lines.findIndex(l => l.includes(testName) || l.includes("test("));

  if (testIndex >= 0) {
    // Extract ~50 lines around the test
    const start = Math.max(0, testIndex - 5);
    const end = Math.min(lines.length, testIndex + 50);
    return lines.slice(start, end).join("\n");
  }

  // Fallback: return first 100 lines
  return lines.slice(0, 100).join("\n");
}

/**
 * Load feature context for the app — C2: targeted matching by test file name
 */
function loadFeatureContext(testFile: string): string {
  // Infer app from test path: tests/avada-plaza/xxx.spec.ts → avada-plaza
  const match = testFile.match(/tests\/([^/]+)\//);
  if (!match) return "";

  const appFolder = match[1];
  const contextDir = path.join(PROJECT_ROOT, "skills/shopify-test-gen/references/app-context", appFolder);

  if (!fs.existsSync(contextDir)) return "";

  const allFiles = fs.readdirSync(contextDir).filter(f => f.endsWith(".md"));

  // C2: Try to match feature context by test file name
  // e.g. image-manager-327b0da4.spec.ts → match "image-manager.md" + "image-manager.scanned.md"
  const testBase = path.basename(testFile, ".spec.ts").replace(/-[a-f0-9]{8}$/, ""); // strip taskId suffix
  const targetFiles: string[] = [];

  // Exact match first (curated), then scanned supplement
  const curatedMatch = allFiles.find(f => f === `${testBase}.md`);
  if (curatedMatch) targetFiles.push(curatedMatch);
  const scannedMatch = allFiles.find(f => f === `${testBase}.scanned.md`);
  if (scannedMatch) targetFiles.push(scannedMatch);

  // Always include _overview.md if it exists
  if (allFiles.includes("_overview.md") && !targetFiles.includes("_overview.md")) {
    targetFiles.unshift("_overview.md");
  }

  // Fallback: if no targeted match, use first 3 files (original behavior)
  const filesToLoad = targetFiles.length > 1 ? targetFiles : allFiles.slice(0, 3);

  const sections: string[] = [];
  for (const file of filesToLoad) {
    const content = fs.readFileSync(path.join(contextDir, file), "utf-8");
    // Only keep UI text sections, skip source files section
    const trimmed = content.replace(/## Source Files[\s\S]*?(?=\n## |$)/, "");
    if (trimmed.length > 2000) {
      sections.push(trimmed.slice(0, 2000) + "\n...");
    } else {
      sections.push(trimmed);
    }
  }

  return sections.join("\n---\n");
}

/**
 * Find test-results directory for a failed test
 */
function findResultDir(testName: string, testFile: string): string | null {
  const resultsDir = path.join(PROJECT_ROOT, "test-results");
  if (!fs.existsSync(resultsDir)) return null;

  const dirs = fs.readdirSync(resultsDir);

  // Try to match by test name keywords
  const keywords = testName.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  for (const dir of dirs) {
    const dirLower = dir.toLowerCase();
    const matchCount = keywords.filter(k => dirLower.includes(k)).length;
    if (matchCount >= 2) return dir;
  }

  // Fallback: match by test file name
  const fileBase = path.basename(testFile, ".spec.ts").replace(/-/g, "");
  for (const dir of dirs) {
    if (dir.includes(fileBase)) return dir;
  }

  return dirs[0] || null;
}

// D1: Tách system (persona+rules) / user (data) messages
async function callAI(systemPrompt: string, userContent: string): Promise<string> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (!gatewayToken) throw new Error("OPENCLAW_GATEWAY_TOKEN chưa set");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayToken}`,
      "x-openclaw-scopes": "operator.read,operator.write",
    },
    body: JSON.stringify({
      model: "openclaw:test-gen",
      max_tokens: 2048,
      messages,
    }),
  });

  if (!res.ok) {
    // Fallback to main agent
    const mainRes = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
        "x-openclaw-scopes": "operator.read,operator.write",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        max_tokens: 2048,
        messages,
      }),
    });
    if (!mainRes.ok) throw new Error(`AI error: ${mainRes.status}`);
    const data = await mainRes.json();
    return data.choices?.[0]?.message?.content || "";
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const { failedTests, testFile } = (await request.json()) as {
      failedTests: FailedTest[];
      testFile?: string;
    };

    if (!failedTests?.length) {
      return NextResponse.json({ error: "No failed tests provided" }, { status: 400 });
    }

    const promptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, "error-analyzer.md"), "utf-8");
    const featureContext = testFile ? loadFeatureContext(testFile) : "";

    // Phase 4: load product spec một lần cho toàn batch (cùng app/feature)
    const productSpecSection = testFile
      ? await loadProductSpecForTest(testFile)
      : (failedTests[0]?.testFile ? await loadProductSpecForTest(failedTests[0].testFile) : "");

    const results: AnalysisResult[] = [];

    // Analyze each failed test (batch max 5)
    for (const failed of failedTests.slice(0, 5)) {
      const resultDir = failed.resultDir || findResultDir(failed.testName, failed.testFile);
      const { errorContext, screenshotPath } = resultDir
        ? loadErrorContext(resultDir)
        : { errorContext: "", screenshotPath: null };

      const testCode = loadTestCode(failed.testFile, failed.testName);

      const userContent = `
---

## Failed Test

**Name:** ${failed.testName}
**File:** ${failed.testFile}
${failed.scenarioDescription ? `\n### Expected Behavior\n${failed.scenarioDescription}\n` : ""}
### Error Message
\`\`\`
${failed.errorMessage.slice(0, 2000)}
\`\`\`

### Page Snapshot (DOM at failure)
${errorContext || "Không có snapshot"}

### Test Code
\`\`\`typescript
${testCode.slice(0, 2000)}
\`\`\`

### Feature Context (expected UI)
${featureContext.slice(0, 2000) || "Không có feature context"}

${productSpecSection}
`;

      try {
        const content = await callAI(promptTemplate, userContent);
        const jsonMatch = content.match(/\{[\s\S]*"diagnosis"[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          results.push({
            testName: failed.testName,
            ...parsed,
            screenshotPath,
          });
        } else {
          results.push({
            testName: failed.testName,
            diagnosis: {
              category: "unknown",
              summary: "Không parse được AI response",
              details: content.slice(0, 500),
              confidence: "low",
            },
            rootCause: { isAppBug: false, isTestBug: false, isEnvIssue: false, explanation: "" },
            suggestions: [],
            evidence: [],
            screenshotPath,
          });
        }
      } catch (err) {
        results.push({
          testName: failed.testName,
          diagnosis: {
            category: "unknown",
            summary: `AI analysis error: ${err}`,
            details: "",
            confidence: "low",
          },
          rootCause: { isAppBug: false, isTestBug: false, isEnvIssue: false, explanation: "" },
          suggestions: [],
          evidence: [],
          screenshotPath,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}
