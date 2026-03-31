"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import PipelinePanel from "./PipelinePanel";
import TestPlanEditor from "./TestPlanEditor";
import TestLibrary from "./TestLibrary";
import { usePipeline, type Scenario } from "@/context/PipelineContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotionInfo {
  pageId: string;
  title: string;
  description: string;
  app: string;
  status: string;
  assignees: string;
  mr: string;
  gitlabInfo: {
    branch?: string;
    title?: string;
    description?: string;
    diff?: string;
    author?: string;
    isMock?: boolean;
    noUrl?: boolean;
  };
}


interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failedTests: string[];
}

interface SystemStatus {
  auth: { ok: boolean; sessionFile: string };
  apps: {
    avadaPlaza: { handle: string | null };
    seo: { handle: string | null };
    blogs: { handle: string | null };
  };
  gateway: { ok: boolean; agentReady: boolean };
  notion: { ok: boolean };
  gitlab: { ok: boolean };
}


interface StagingVerifyResult {
  found: boolean;
  match?: boolean;
  deployedBranch?: string;
  expectedBranch?: string;
  envName?: string;
  deployedAt?: string;
  deployStatus?: string;
  reason?: string;
  loading?: boolean;
}

const APP_SUITE_MAP: Record<string, string> = {
  "App plaza Image optimizer": "avada-plaza",
  "Avada SEO suite": "seo",
  "Avada SEO On Blog": "blogs",
};

function resolveAppKey(app: string): string {
  const lower = app.toLowerCase();
  if (lower.includes("plaza") || lower.includes("image")) return "avadaPlaza";
  if (lower.includes("seo")) return "seo";
  if (lower.includes("blog")) return "blogs";
  return "avadaPlaza";
}

function mapAppToSuite(app: string): string {
  for (const [key, suite] of Object.entries(APP_SUITE_MAP)) {
    if (app.toLowerCase().includes(key.toLowerCase())) return suite;
  }
  return "smoke";
}

const TYPE_COLORS_PAGE: Record<string, string> = {
  smoke: "bg-green-100 text-green-800",
  regression: "bg-blue-100 text-blue-800",
  guard: "bg-yellow-100 text-yellow-800",
  "edge-case": "bg-purple-100 text-purple-800",
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {ok ? "✅" : "❌"} {label}
    </span>
  );
}

function StatusPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart/status");
      if (res.ok) {
        const data = await res.json() as SystemStatus;
        setStatus(data);
        // Auto-collapse if everything is OK
        const allOk = data.auth.ok && data.gateway.ok && data.notion.ok;
        setCollapsed(allOk);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleOK = (s: SystemStatus) =>
    s.auth.ok && s.gateway.ok && s.notion.ok;

  return (
    <Card className="border border-dashed">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            System Status
            {status && handleOK(status) && (
              <span className="text-xs font-normal text-green-600">— All OK</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void loadStatus()} disabled={loading}>
              {loading ? <Spinner /> : "↻ Refresh"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? "▼ Show" : "▲ Hide"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 px-4 pb-4">
          {loading && !status ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Loading system status...
            </div>
          ) : status ? (
            <div className="space-y-3">
              {/* Apps row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded border bg-muted/30 p-2 space-y-1">
                  <div className="font-medium text-xs text-muted-foreground">Shopify Auth</div>
                  <StatusBadge ok={status.auth.ok} label={status.auth.ok ? "Active" : "Missing"} />
                </div>
                <div className="rounded border bg-muted/30 p-2 space-y-1">
                  <div className="font-medium text-xs text-muted-foreground">Avada Plaza</div>
                  <StatusBadge ok={Boolean(status.apps.avadaPlaza.handle)} label={status.apps.avadaPlaza.handle ?? "--"} />
                </div>
                <div className="rounded border bg-muted/30 p-2 space-y-1">
                  <div className="font-medium text-xs text-muted-foreground">SEO</div>
                  <StatusBadge ok={Boolean(status.apps.seo.handle)} label={status.apps.seo.handle ?? "--"} />
                </div>
                <div className="rounded border bg-muted/30 p-2 space-y-1">
                  <div className="font-medium text-xs text-muted-foreground">Blogs</div>
                  <StatusBadge ok={Boolean(status.apps.blogs.handle)} label={status.apps.blogs.handle ?? "--"} />
                </div>
              </div>

              {/* Services row */}
              <div className="flex flex-wrap gap-2 text-sm">
                <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-1.5 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">OpenClaw Gateway</span>
                  <StatusBadge ok={status.gateway.ok} label={status.gateway.ok ? "Connected (test-gen ready)" : "Offline"} />
                </div>
                <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Notion Token</span>
                  <StatusBadge ok={status.notion.ok} label={status.notion.ok ? "Configured" : "Missing"} />
                </div>
                <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">GitLab Token</span>
                  <StatusBadge ok={status.gitlab.ok} label={status.gitlab.ok ? "Configured" : "Missing"} />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-red-500">Không load được system status</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function SmartRunPage() {
  // Mode: "generate" (AI pipeline) or "library" (pick existing tests)
  const [mode, setMode] = useState<"generate" | "library">("generate");
  // Step 1 input mode: "notion" or "manual"
  const [inputMode, setInputMode] = useState<"notion" | "manual">("notion");

  // Manual input state
  const [manualApp, setManualApp] = useState("avadaPlaza");
  const [manualBranch, setManualBranch] = useState("master");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualBugs, setManualBugs] = useState("");
  const [manualReady, setManualReady] = useState(false);

  // Step 1 state
  const [notionUrl, setNotionUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [notionInfo, setNotionInfo] = useState<NotionInfo | null>(null);
  const [parseError, setParseError] = useState("");

  // AI notes (appended to description for flow planner)
  const [aiNotes, setAiNotes] = useState("");

  // Step 2 state (Test Plan Review)
  const {
    testPlan, confirmedPlan, planLoading, planError, planContext,
    generatePlan, confirmPlan, generateCode,
    running: codeRunning, steps: codeSteps, result: codeResult, error: codeError,
    setNotionUrl: ctxSetNotionUrl, setManualInput: ctxSetManualInput, setStageNum: ctxSetStageNum,
  } = usePipeline();

  // Step 3 state (Generate Code)
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);
  const [pipelineDone, setPipelineDone] = useState(false);

  // Step 3 state
  const [runLogs, setRunLogs] = useState<Array<{type: string; text: string}>>([]);
  const [env, setEnv] = useState("local");
  const [locale, setLocale] = useState("en");
  const [stageNum, setStageNum] = useState("1");
  const [stagingVerify, setStagingVerify] = useState<StagingVerifyResult | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [onlyRunGenerated, setOnlyRunGenerated] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);
  const [errorAnalyses, setErrorAnalyses] = useState<Array<{
    testName: string;
    diagnosis: { category: string; summary: string; details: string; confidence: string };
    rootCause: { isAppBug: boolean; isTestBug: boolean; isEnvIssue: boolean; explanation: string };
    suggestions: Array<{ action: string; description: string; code?: string }>;
    evidence: string[];
  }>>([]);
  const [analyzingErrors, setAnalyzingErrors] = useState(false);
  const [envPreview, setEnvPreview] = useState<{
    store: string;
    apps: Record<string, { handle: string; envKey: string; ok: boolean }>;
    session: { ok: boolean; file: string; ageHours: number; expired: boolean };
  } | null>(null);

  const handleParseNotion = async () => {
    setParsing(true);
    setParseError("");
    setNotionInfo(null);
    setGeneratedFiles([]);
    setPipelineDone(false);
    setSummary(null);

    try {
      const res = await fetch("/api/smart/parse-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse Notion URL");
      setNotionInfo(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setParsing(false);
    }
  };

  const handlePipelineFilesGenerated = useCallback((files: string[]) => {
    setGeneratedFiles(files);
    setPipelineDone(true);
  }, []);

  // Sync context state and trigger plan generation
  const handleGeneratePlan = useCallback(() => {
    ctxSetStageNum(stageNum);
    if (inputMode === "manual" && manualReady) {
      // Manual mode — clear Notion URL, only send manual input
      ctxSetNotionUrl("");
      const desc = aiNotes
        ? `${manualDescription}\n\n--- Ghi chú thêm ---\n${aiNotes}`
        : manualDescription;
      ctxSetManualInput({
        app: manualApp,
        branch: manualBranch,
        title: manualTitle,
        description: desc,
        bugs: manualBugs,
      });
    } else if (inputMode === "notion" && notionInfo) {
      // Notion mode — clear manual input, only send Notion URL
      ctxSetNotionUrl(notionUrl);
      if (aiNotes) {
        ctxSetManualInput({
          app: resolveAppKey(notionInfo.app),
          branch: notionInfo.gitlabInfo?.branch || "master",
          title: notionInfo.title,
          description: `${notionInfo.description}\n\n--- Ghi chú thêm ---\n${aiNotes}`,
          bugs: "",
        });
      } else {
        ctxSetManualInput(null);
      }
    } else {
      return; // No valid input — do nothing
    }
    // Delay to allow state to propagate, then generate
    setTimeout(() => generatePlan(), 50);
  }, [inputMode, notionUrl, stageNum, manualReady, manualApp, manualBranch, manualTitle, manualDescription, manualBugs, aiNotes, notionInfo, ctxSetNotionUrl, ctxSetStageNum, ctxSetManualInput, generatePlan]);

  // Sync code generation result → generatedFiles
  useEffect(() => {
    if (codeResult?.type === "done" && codeResult.files && codeResult.files.length > 0) {
      setGeneratedFiles(codeResult.files);
      setPipelineDone(true);
    }
  }, [codeResult]);

  const handleLibrarySelect = useCallback((files: string[]) => {
    setGeneratedFiles(files);
    setPipelineDone(true);
  }, []);

  const handleUpdateNotion = useCallback(async (pageId: string, runSummary: RunSummary) => {
    setUpdating(true);
    setUpdateResult(null);

    try {
      const res = await fetch("/api/smart/update-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionPageId: pageId,
          results: runSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Notion");
      setUpdateResult("✅ Kết quả test đã được ghi vào Notion");
    } catch (err) {
      setUpdateResult(
        `❌ ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setUpdating(false);
    }
  }, []);

  const handleVerifyStaging = useCallback(async (num: string) => {
    if (!notionInfo?.mr || !notionInfo?.gitlabInfo?.branch) return;
    setStagingVerify({ loading: true, found: false });
    try {
      const res = await fetch("/api/smart/verify-staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mrUrl: notionInfo.mr,
          stageNum: parseInt(num),
          expectedBranch: notionInfo.gitlabInfo.branch,
        }),
      });
      const data = await res.json();
      setStagingVerify(data);
    } catch {
      setStagingVerify({ found: false, reason: "Không kết nối được GitLab" });
    }
  }, [notionInfo]);

  // Load preview khi mount
  useEffect(() => { fetchEnvPreview("local", "1"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEnvPreview = useCallback(async (envVal: string, stageVal: string) => {
    try {
      const res = await fetch(`/api/smart/env-preview?env=${envVal}&stageNum=${stageVal}`);
      const data = await res.json();
      setEnvPreview(data);
    } catch { /* ignore */ }
  }, []);

  const handleEnvChange = (value: string) => {
    setEnv(value);
    setStagingVerify(null);
    setSummary(null);
    fetchEnvPreview(value, stageNum);
  };

  const handleStageNumChange = (value: string) => {
    setStageNum(value);
    setStagingVerify(null);
    if (env === "staging") handleVerifyStaging(value);
    fetchEnvPreview(env, value);
  };

  const handleRunTests = async () => {
    // Library mode: can run without notionInfo
    const hasInput = (inputMode === "notion" && notionInfo) || (inputMode === "manual" && manualReady);
    if (mode === "generate" && !hasInput) return;
    if (generatedFiles.length === 0 && !hasInput) return;

    setRunning(true);
    setSummary(null);
    setUpdateResult(null);

    const suite = notionInfo ? mapAppToSuite(notionInfo.app) : "all";
    const useSpecificFiles = onlyRunGenerated && generatedFiles.length > 0;

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suite,
          env,
          locale,
          ...(useSpecificFiles ? { testFiles: generatedFiles } : {}),
          headed: showBrowser,
          // Context cho pre-flight checks + staging verify (may be null in library mode)
          mrUrl: notionInfo?.mr || undefined,
          stageNum: env === "staging" ? parseInt(stageNum) : undefined,
          expectedBranch: notionInfo?.gitlabInfo?.branch || undefined,
          appKey: notionInfo?.app ? resolveAppKey(notionInfo.app) : undefined,
        }),
      });
      const { runId } = await res.json();

      const eventSource = new EventSource(`/api/run/${runId}/stream`);

      setRunLogs([]);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "step" || data.type === "log") {
          setRunLogs(prev => [...prev, { type: data.type, text: data.text }]);
        }
        if (data.type === "done") {
          setSummary(data.summary);
          setRunning(false);
          eventSource.close();
          if (notionInfo?.pageId) handleUpdateNotion(notionInfo.pageId, data.summary);
        }
      };

      eventSource.onerror = () => {
        setRunning(false);
        eventSource.close();
      };
    } catch {
      setRunning(false);
    }
  };

  const isMock = notionInfo?.gitlabInfo?.isMock;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Smart Run</h1>
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
          <Button
            variant={mode === "generate" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setMode("generate"); setGeneratedFiles([]); setPipelineDone(false); }}
          >
            🤖 Generate mới
          </Button>
          <Button
            variant={mode === "library" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setMode("library"); setGeneratedFiles([]); setPipelineDone(false); }}
          >
            📂 Test có sẵn
          </Button>
        </div>
      </div>

      {/* System Status Panel */}
      <StatusPanel />

      {/* === LIBRARY MODE === */}
      {mode === "library" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">📂</Badge>
              Chọn test file có sẵn
              {generatedFiles.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 ml-auto">
                  ✅ {generatedFiles.length} file{generatedFiles.length > 1 ? "s" : ""} đã chọn
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TestLibrary onSelect={handleLibrarySelect} />
          </CardContent>
        </Card>
      )}

      {/* === GENERATE MODE: STEP 1 === */}
      {mode === "generate" && (
      <>
      {/* STEP 1: Task Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">Step 1</Badge>
            Task Input
            {/* Toggle Notion / Manual */}
            <div className="ml-auto flex rounded-md border overflow-hidden text-sm">
              <button
                className={`px-3 py-1 ${inputMode === "notion" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => { setInputMode("notion"); setManualReady(false); }}
              >📋 Notion</button>
              <button
                className={`px-3 py-1 ${inputMode === "manual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                onClick={() => { setInputMode("manual"); setNotionInfo(null); }}
              >✏️ Manual</button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* === NOTION INPUT === */}
          {inputMode === "notion" && (
          <div className="flex gap-2">
            <Input
              placeholder="Paste Notion task URL..."
              value={notionUrl}
              onChange={(e) => setNotionUrl(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && notionUrl && !parsing)
                  handleParseNotion();
              }}
            />
            <Button
              onClick={handleParseNotion}
              disabled={!notionUrl || parsing}
            >
              {parsing ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Parsing...
                </span>
              ) : (
                "Parse"
              )}
            </Button>
          </div>
          )}

          {/* === MANUAL INPUT === */}
          {inputMode === "manual" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>App</Label>
                <Select value={manualApp} onValueChange={(v) => {
                  setManualApp(v);
                  setManualTitle("");
                  setManualDescription("");
                  setManualBugs("");
                  setManualReady(false);
                  setAiNotes("");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avadaPlaza">Avada Plaza</SelectItem>
                    <SelectItem value="seo">Avada SEO</SelectItem>
                    <SelectItem value="blogs">Avada Blogs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Branch</Label>
                <Input
                  placeholder="master"
                  value={manualBranch}
                  onChange={(e) => setManualBranch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tên tính năng / Task title</Label>
              <Input
                placeholder="VD: Image Manager v2 — bỏ confirmation modal"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Mô tả flow cần test</Label>
              <textarea
                className="textarea"
                placeholder={`VD:\n- Vào Image Manager → click Optimize now\n- Chọn Optimize all\n- Kỳ vọng: không có modal xác nhận\n- Toast 'Optimization started' phải hiện trong 5s`}
                value={manualDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setManualDescription(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Bugs cần regression (tuỳ chọn)</Label>
              <textarea
                className="textarea"
                placeholder={"VD: Bug #1 — Revert button vẫn hiện khi không nên\nBug #2 — Sort column gây lỗi UI"}
                value={manualBugs}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setManualBugs(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={() => {
                if (!manualTitle || !manualDescription) return;
                setManualReady(true);
              }}
              disabled={!manualTitle || !manualDescription}
              className="w-full"
            >
              ✅ Xác nhận — Tiến tới Generate Test
            </Button>
            {manualReady && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                ✅ Ready — <strong>{manualTitle}</strong> ({manualApp}, branch: {manualBranch})
              </div>
            )}
          </div>
          )}

          {/* AI Notes — shown after Notion parse or manual confirm (scoped to active tab) */}
          {((inputMode === "notion" && notionInfo) || (inputMode === "manual" && manualReady)) && (
            <div className="space-y-1 pt-2 border-t">
              <Label className="text-muted-foreground">Ghi chú thêm cho AI (tuỳ chọn)</Label>
              <textarea
                className="textarea"
                placeholder="VD: Tập trung test phần bulk action, bỏ qua phần filter..."
                value={aiNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}


          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {notionInfo && (
            <div className="space-y-3">
              {isMock && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                  ⚠️ GitLab mock data — configure GITLAB_TOKEN for real data
                </div>
              )}

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{notionInfo.title}</h3>
                  {notionInfo.status && (
                    <Badge variant="secondary">{notionInfo.status}</Badge>
                  )}
                </div>
                {notionInfo.description && (
                  <p className="text-sm text-muted-foreground">
                    {notionInfo.description.slice(0, 200)}
                    {notionInfo.description.length > 200 && "..."}
                  </p>
                )}
                <div className="grid gap-1 text-sm">
                  {notionInfo.app && (
                    <div>
                      <span className="font-medium">App:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {notionInfo.app}
                      </Badge>
                    </div>
                  )}
                  {notionInfo.assignees && (
                    <div>
                      <span className="font-medium">Assign:</span>{" "}
                      {notionInfo.assignees}
                    </div>
                  )}
                  {notionInfo.mr && (
                    <div>
                      <span className="font-medium">MR:</span>{" "}
                      <span className="text-muted-foreground break-all">
                        {notionInfo.mr}
                      </span>
                    </div>
                  )}
                  {notionInfo.gitlabInfo?.branch && (
                    <div>
                      <span className="font-medium">Branch:</span>{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {notionInfo.gitlabInfo.branch}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 2: Test Plan Review (scoped to active tab) */}
      {((inputMode === "notion" && notionInfo) || (inputMode === "manual" && manualReady)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">Step 2</Badge>
              Test Plan Review
              {testPlan && (
                <Badge className="bg-blue-100 text-blue-800 ml-auto">
                  {testPlan.length} scenarios
                </Badge>
              )}
              {confirmedPlan && (
                <Badge className="bg-green-100 text-green-800 ml-2">
                  ✅ {confirmedPlan.length} confirmed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate plan button */}
            {!testPlan && !planLoading && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleGeneratePlan}
                disabled={planLoading}
              >
                🧠 Tạo Test Plan
              </Button>
            )}

            {/* Loading state */}
            {planLoading && (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <Spinner />
                <span className="text-sm text-muted-foreground">AI đang phân tích và tạo test plan...</span>
              </div>
            )}

            {/* Plan error */}
            {planError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-mono whitespace-pre-wrap">
                ❌ {planError}
              </div>
            )}

            {/* Test Plan Editor */}
            {testPlan && !confirmedPlan && (
              <TestPlanEditor
                scenarios={testPlan}
                onConfirm={(confirmed) => {
                  confirmPlan(confirmed);
                }}
                loading={false}
              />
            )}

            {/* After confirmation summary */}
            {confirmedPlan && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                ✅ Test plan đã xác nhận — {confirmedPlan.length} scenarios sẵn sàng generate code
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Generate Code */}
      {confirmedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">Step 3</Badge>
              Generate Code
              {pipelineDone && generatedFiles.length > 0 && (
                <Badge className="bg-green-100 text-green-800 ml-auto">
                  ✅ {generatedFiles.length} file{generatedFiles.length > 1 ? "s" : ""} ready
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate code button */}
            {!codeRunning && !codeResult && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  generateCode();
                }}
              >
                ✍️ Generate Test Code
              </Button>
            )}

            {/* Code generation progress */}
            {codeSteps.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-zinc-950 p-3 font-mono text-sm max-h-72 overflow-y-auto">
                {codeSteps.map((step, i) => (
                  <div key={i}>
                    {step.type === "step" && (
                      <span className={
                        step.text?.includes("⚠️") ? "text-amber-400" :
                        step.text?.includes("✅") ? "text-green-400" :
                        "text-zinc-300"
                      }>{step.text}</span>
                    )}
                    {step.type === "warn" && (
                      <span className="text-amber-400">{step.text}</span>
                    )}
                    {step.type === "layer-done" && (
                      <span className="text-green-400 font-semibold">
                        ✅ {step.title}
                        {step.files?.length ? ` → ${step.files.join(", ")}` : ""}
                      </span>
                    )}
                  </div>
                ))}
                {codeRunning && <div className="text-zinc-500 animate-pulse">▌</div>}
              </div>
            )}

            {/* Code error */}
            {codeError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-mono whitespace-pre-wrap">
                ❌ {codeError}
              </div>
            )}

            {/* Code result */}
            {codeResult && (
              <div className={`rounded-lg border p-4 space-y-3 ${codeResult.files && codeResult.files.length > 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                {codeResult.files && codeResult.files.length > 0 ? (
                  <>
                    <div>
                      <p className="font-semibold text-green-800">✅ Files created:</p>
                      <ul className="mt-1 list-disc list-inside text-sm font-mono">
                        {codeResult.files.map((f, i) => (
                          <li key={i} className="text-green-700">{f}</li>
                        ))}
                      </ul>
                    </div>
                    <Badge variant={codeResult.validated ? "default" : "destructive"}>
                      {codeResult.validated ? "✅ Syntax OK" : "⚠️ Needs manual fix"}
                    </Badge>
                  </>
                ) : (
                  <p className="text-amber-700">⚠️ No test files were created. Check logs above.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </>
      )}

      {/* STEP 4: Review + Run (shown in both modes after files are selected) */}
      {pipelineDone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">{mode === "library" ? "Step 2" : "Step 4"}</Badge>
              Review & Run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-1 text-sm">
              {notionInfo && (
                <>
                  <div>
                    <span className="font-medium">Task:</span>{" "}
                    {notionInfo.title}
                  </div>
                  <div>
                    <span className="font-medium">App:</span>{" "}
                    {notionInfo.app || "Unknown"}
                    <span className="text-muted-foreground ml-2">
                      → suite: {mapAppToSuite(notionInfo.app || "")}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Branch:</span>{" "}
                    {notionInfo.gitlabInfo?.branch || (
                      <span className="text-yellow-600">mock / not available</span>
                    )}
                  </div>
                </>
              )}
              <div>
                <span className="font-medium">Test files:</span>{" "}
                {generatedFiles.length > 0
                  ? (
                    <ul className="inline">
                      {generatedFiles.map((f, i) => (
                        <li key={i} className="inline">
                          {i > 0 && ", "}
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{f}</code>
                        </li>
                      ))}
                    </ul>
                  )
                  : <span className="text-muted-foreground">chưa có</span>}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  id="onlyRunGenerated"
                  checked={onlyRunGenerated}
                  onChange={(e) => setOnlyRunGenerated(e.target.checked)}
                  disabled={generatedFiles.length === 0}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="onlyRunGenerated" className={`cursor-pointer ${generatedFiles.length === 0 ? "text-muted-foreground" : ""}`}>
                  {generatedFiles.length > 0 && onlyRunGenerated
                    ? `Chạy ${generatedFiles.length} test file${generatedFiles.length > 1 ? "s" : ""} đã chọn`
                    : "Chạy toàn bộ suite"}
                </label>
                {generatedFiles.length === 0 && (
                  <span className="text-xs text-muted-foreground">(chưa có file — sẽ chạy toàn suite)</span>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  id="showBrowser"
                  checked={showBrowser}
                  onChange={(e) => setShowBrowser(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="showBrowser" className="cursor-pointer">
                  🖥️ Hiển thị browser khi chạy test
                </label>
                {showBrowser && (
                  <span className="text-xs text-yellow-600">(chậm hơn headless)</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={env} onValueChange={handleEnvChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ngôn ngữ</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇺🇸 English (en)</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch (de)</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français (fr)</SelectItem>
                    <SelectItem value="vi">🇻🇳 Tiếng Việt (vi)</SelectItem>
                    <SelectItem value="zh-CN">🇨🇳 中文 (zh-CN)</SelectItem>
                    <SelectItem value="nl">🇳🇱 Nederlands (nl)</SelectItem>
                    <SelectItem value="pt-BR">🇧🇷 Português (pt-BR)</SelectItem>
                    <SelectItem value="da">🇩🇰 Dansk (da)</SelectItem>
                    <SelectItem value="sv">🇸🇪 Svenska (sv)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {env === "staging" && (
                <div className="space-y-2">
                  <Label>Staging số</Label>
                  <div className="flex gap-2 items-center">
                    <Select value={stageNum} onValueChange={handleStageNumChange}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>Staging {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerifyStaging(stageNum)}
                      disabled={stagingVerify?.loading}
                    >
                      {stagingVerify?.loading ? <Spinner /> : "Kiểm tra"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Env Preview — handle + session info */}
            {envPreview && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Sẽ sử dụng
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {envPreview.session.ok
                      ? `✅ Session (${envPreview.session.ageHours}h tuổi)`
                      : envPreview.session.expired
                      ? `❌ Session hết hạn — chạy: npm run auth:reset && npm run auth`
                      : `❌ Chưa login — chạy: npm run auth`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-muted-foreground">Store</div>
                  <div className={envPreview.store ? "font-mono" : "text-red-500"}>
                    {envPreview.store || "❌ STORE_HANDLE chưa set"}
                  </div>
                  {Object.entries(envPreview.apps).map(([key, info]) => (
                    <React.Fragment key={key}>
                      <div className="text-muted-foreground">{key}</div>
                      <div className={info.ok ? "font-mono" : "text-yellow-600"}>
                        {info.ok ? info.handle : `⚪ (${info.envKey} chưa set)`}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Staging verify result */}
            {env === "staging" && stagingVerify && !stagingVerify.loading && (
              <div className={`rounded-lg border p-3 text-sm space-y-1 ${
                stagingVerify.match
                  ? "border-green-200 bg-green-50 text-green-800"
                  : stagingVerify.found
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
              }`}>
                {stagingVerify.match && (
                  <>
                    <div className="font-medium">✅ Staging {stageNum} đang deploy đúng branch</div>
                    <div className="text-xs opacity-80">
                      Branch: <code className="bg-black/10 px-1 rounded">{stagingVerify.deployedBranch}</code>
                      {stagingVerify.envName && <> · Env: {stagingVerify.envName}</>}
                    </div>
                  </>
                )}
                {stagingVerify.found && !stagingVerify.match && (
                  <>
                    <div className="font-medium">⚠️ Staging {stageNum} đang deploy sai branch</div>
                    <div className="text-xs space-y-0.5">
                      <div>Đang deploy: <code className="bg-black/10 px-1 rounded">{stagingVerify.deployedBranch}</code></div>
                      <div>Cần deploy: <code className="bg-black/10 px-1 rounded">{stagingVerify.expectedBranch}</code></div>
                      <div className="mt-1 font-medium">→ Báo dev deploy lại trước khi chạy test.</div>
                    </div>
                  </>
                )}
                {!stagingVerify.found && (
                  <>
                    <div className="font-medium">❓ Không tìm được deployment info</div>
                    <div className="text-xs opacity-80">{stagingVerify.reason || "Có thể environment name chưa khớp"} · Vẫn có thể chạy test.</div>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleRunTests}
              disabled={running || (env === "staging" && stagingVerify?.found === true && stagingVerify?.match === false)}
              size="lg"
              className="w-full"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Running tests...
                </span>
              ) : env === "staging" && stagingVerify?.found === true && stagingVerify?.match === false ? (
                "⛔ Deploy đúng branch trước"
              ) : (
                "▶ Run Tests"
              )}
            </Button>

            {/* Run logs — hiển thị khi đang chạy hoặc sau khi xong */}
            {runLogs.length > 0 && (
              <div className="rounded-lg border bg-zinc-950 p-3 font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto">
                {runLogs.map((log, i) => (
                  <div key={i} className={
                    log.type === "step"
                      ? log.text.includes("❌") || log.text.includes("FAIL")
                        ? "text-red-400"
                        : log.text.includes("⚠️")
                        ? "text-yellow-400"
                        : "text-blue-400"
                      : log.text.startsWith("PASS:")
                      ? "text-green-400"
                      : log.text.startsWith("FAIL:")
                      ? "text-red-400"
                      : "text-zinc-400"
                  }>
                    {log.text.replace(/^(PASS|FAIL|SKIP|STEP): /, "")}
                  </div>
                ))}
                {running && <div className="text-zinc-500 animate-pulse">▌</div>}
              </div>
            )}

            {/* Test descriptions from confirmed plan */}
            {confirmedPlan && confirmedPlan.length > 0 && (summary || running) && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Test Scenarios</p>
                <div className="space-y-1">
                  {confirmedPlan.map((s, i) => {
                    const testFailed = summary?.failedTests.some(t => t.includes(s.name));
                    const testPassed = summary && !testFailed;
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm bg-muted/30 rounded p-2 border">
                        <span className="shrink-0">{testPassed ? "✅" : testFailed ? "❌" : "⏳"}</span>
                        <div className="min-w-0">
                          <span className="font-medium">{s.name}</span>
                          {s.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                          )}
                        </div>
                        <Badge className={`text-xs shrink-0 ${TYPE_COLORS_PAGE[s.type] || "bg-gray-100"}`}>{s.type}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {summary && (
              <div className="space-y-4">
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.passed}
                    </div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {summary.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(summary.duration / 1000).toFixed(1)}s
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Duration
                    </div>
                  </div>
                </div>

                {summary.failedTests.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-red-600 mb-2">
                      Failed Tests:
                    </h3>
                    <ul className="space-y-1">
                      {summary.failedTests.map((test, i) => (
                        <li key={i} className="text-sm text-red-500 font-mono">
                          ✗ {test}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={analyzingErrors}
                      onClick={async () => {
                        setAnalyzingErrors(true);
                        setErrorAnalyses([]);
                        try {
                          const failedTests = summary.failedTests.map(t => ({
                            testName: t,
                            errorMessage: runLogs
                              .filter(l => l.text.includes("Error:") || l.text.includes("timeout"))
                              .map(l => l.text)
                              .join("\n")
                              .slice(0, 3000),
                            testFile: generatedFiles[0] || "",
                          }));
                          const res = await fetch("/api/smart/analyze-errors", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ failedTests }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setErrorAnalyses(data.results || []);
                          }
                        } catch { /* ignore */ }
                        finally { setAnalyzingErrors(false); }
                      }}
                    >
                      {analyzingErrors ? "🔍 Analyzing..." : "🔍 AI Analyze Errors"}
                    </Button>

                    {/* Error Analysis Results */}
                    {errorAnalyses.length > 0 && (
                      <div className="mt-3 space-y-3">
                        <h4 className="font-semibold text-sm">🔍 Error Analysis:</h4>
                        {errorAnalyses.map((a, i) => (
                          <div key={i} className="border rounded p-2 text-sm space-y-1">
                            <div className="flex gap-2 items-center">
                              <Badge variant="outline">{a.diagnosis.category}</Badge>
                              <span className="font-medium">{a.diagnosis.summary}</span>
                            </div>
                            <p className="text-gray-600 text-xs">{a.diagnosis.details}</p>
                            <div className="flex gap-1 text-xs">
                              {a.rootCause.isAppBug && <Badge variant="destructive">🐛 App Bug</Badge>}
                              {a.rootCause.isTestBug && <Badge className="bg-amber-100 text-amber-800">🧪 Test Bug</Badge>}
                              {a.rootCause.isEnvIssue && <Badge className="bg-orange-100 text-orange-800">⚙️ Env</Badge>}
                            </div>
                            {a.suggestions.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {a.suggestions.map((s, j) => (
                                  <li key={j}>→ <strong>{s.action}:</strong> {s.description}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {updating && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 flex items-center gap-2">
                    <Spinner /> Đang cập nhật Notion...
                  </div>
                )}

                {updateResult && (
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      updateResult.startsWith("❌")
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }`}
                  >
                    {updateResult}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
