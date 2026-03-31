"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Feature {
  name: string;
  file: string;
  app: string;
  testCount: number;
  updatedAt: string;
}

interface ActiveSession {
  id: string;
  app: string;
  testName: string;
  featureName: string;
  startedAt: string;
}

type Step = "idle" | "recording" | "review";

const APP_LABELS: Record<string, string> = {
  avadaPlaza: "🏬 Avada Plaza",
  seo: "🔍 SEO Suite",
  blogs: "📝 Blogs",
};

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "vừa xong";
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
}

export default function RecordPage() {
  // Form state
  const [app, setApp] = useState("avadaPlaza");
  const [featureName, setFeatureName] = useState("");
  const [testName, setTestName] = useState("");

  // Session state
  const [step, setStep] = useState<Step>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recordedCode, setRecordedCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ featureFile: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Feature list
  const [features, setFeatures] = useState<Feature[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  const loadFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/record");
      const data = await res.json() as { features: Feature[]; active: ActiveSession[] };
      setFeatures(data.features ?? []);
      setActiveSessions(data.active ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadFeatures(); }, [loadFeatures]);

  // ── Start recording ──────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!featureName.trim() || !testName.trim()) {
      setError("Vui lòng nhập Feature name và Test case name.");
      return;
    }
    setError(null);
    setSaveResult(null);

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", app, featureName, testName }),
      });
      const data = await res.json() as { sessionId?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Không thể khởi động Codegen.");
        return;
      }

      setSessionId(data.sessionId ?? null);
      setStep("recording");
    } catch {
      setError("Network error — thử lại.");
    }
  };

  // ── Stop recording ────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (!sessionId) return;

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId }),
      });
      const data = await res.json() as { code?: string; hasCode?: boolean; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Không thể dừng recording.");
        return;
      }

      setRecordedCode(data.code ?? "");
      setStep("review");
    } catch {
      setError("Network error khi stop recording.");
    }
  };

  // ── Save test case ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", sessionId }),
      });
      const data = await res.json() as { saved?: boolean; featureFile?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Không thể lưu test case.");
        return;
      }

      setSaveResult({ featureFile: data.featureFile ?? "" });
      setStep("idle");
      setSessionId(null);
      setRecordedCode("");
      setTestName("");
      void loadFeatures();
    } catch {
      setError("Network error khi lưu.");
    } finally {
      setSaving(false);
    }
  };

  // ── Add another test to same feature ─────────────────────────────────────
  const handleAddAnother = () => {
    setStep("idle");
    setSessionId(null);
    setRecordedCode("");
    setTestName("");
    setError(null);
    // Keep featureName + app so tester just enters new test name
  };

  // ── Delete feature ────────────────────────────────────────────────────────
  const handleDeleteFeature = async (featureFile: string) => {
    if (!window.confirm(`Xóa feature "${featureFile}"?`)) return;
    await fetch("/api/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", featureFile }),
    });
    void loadFeatures();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🎬 Record Tests</h1>
        <p className="text-muted-foreground mt-1">
          Ghi lại thao tác thực tế → tự động tạo test case
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: Recorder ── */}
        <div className="space-y-4">

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <StepDot active={step === "idle"} done={step !== "idle"} label="1. Cấu hình" />
            <div className="flex-1 h-px bg-border" />
            <StepDot active={step === "recording"} done={step === "review"} label="2. Recording" />
            <div className="flex-1 h-px bg-border" />
            <StepDot active={step === "review"} done={!!saveResult} label="3. Lưu" />
          </div>

          {/* ── STEP 1: Config ── */}
          {step === "idle" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cấu hình test case mới</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>App</Label>
                  <Select value={app} onValueChange={setApp}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APP_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Feature name</Label>
                  <Input
                    placeholder="vd: compress-images, optimize-flow..."
                    value={featureName}
                    onChange={e => setFeatureName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nhiều test cases có thể lưu vào cùng 1 feature
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Test case name</Label>
                  <Input
                    placeholder="vd: Smoke - trang tải đầy đủ UI"
                    value={testName}
                    onChange={e => setTestName(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button className="w-full" onClick={() => void handleStart()}>
                  🎬 Bắt đầu Recording
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 2: Recording ── */}
          {step === "recording" && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  Đang ghi — thực hiện thao tác trên browser
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-1">
                  <p>📱 <strong>App:</strong> {APP_LABELS[app]}</p>
                  <p>📁 <strong>Feature:</strong> {featureName}</p>
                  <p>🧪 <strong>Test:</strong> {testName}</p>
                </div>

                <div className="rounded-md bg-white border p-3 text-sm space-y-1 text-muted-foreground">
                  <p>1. Playwright Codegen đã mở trên máy bạn</p>
                  <p>2. Thực hiện các thao tác muốn test trên browser</p>
                  <p>3. Nhấn <strong>Dừng</strong> khi hoàn tất test case này</p>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button variant="destructive" className="w-full" onClick={() => void handleStop()}>
                  ⏹ Dừng Recording
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 3: Review & Save ── */}
          {step === "review" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Xem lại & Lưu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-1">
                  <p>📁 <strong>Feature:</strong> {featureName}</p>
                  <p>🧪 <strong>Test:</strong> {testName}</p>
                </div>

                {recordedCode ? (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Code được ghi lại ({recordedCode.split("\n").length} dòng)
                    </Label>
                    <pre className="max-h-64 overflow-auto rounded-md bg-zinc-900 text-zinc-100 text-xs p-3 font-mono whitespace-pre-wrap">
                      {recordedCode}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                    ⚠️ Không có code được ghi lại — có thể browser đã đóng trước khi thao tác. Thử lại.
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => void handleSave()}
                    disabled={saving || !recordedCode}
                  >
                    {saving ? "⏳ Đang lưu..." : `💾 Lưu vào "${featureName}"`}
                  </Button>
                  <Button variant="outline" onClick={handleAddAnother}>
                    Bỏ qua
                  </Button>
                </div>

                {saveResult && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    ✅ Đã lưu vào <code className="font-mono">{saveResult.featureFile}</code>
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={handleAddAnother}>
                        ➕ Thêm test case vào {featureName}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active sessions warning */}
          {activeSessions.length > 0 && step === "idle" && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              ⚠️ Có {activeSessions.length} session đang chạy từ trước. Refresh trang nếu cần.
            </div>
          )}
        </div>

        {/* ── Right: Feature list ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>📚 Recorded Features</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void loadFeatures()}>
                  ↻ Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {features.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Chưa có feature nào được ghi lại.
                  <br />Bắt đầu recording để tạo test case đầu tiên.
                </p>
              ) : (
                <div className="space-y-2">
                  {features.map(f => (
                    <div key={f.name} className="flex items-start justify-between rounded-lg border p-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{f.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {f.testCount} test{f.testCount !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {f.app}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(f.updatedAt)} · <code className="font-mono">{f.file}</code>
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setFeatureName(f.name);
                            setApp(
                              Object.entries(APP_LABELS).find(([, l]) =>
                                l.toLowerCase().includes(f.app.toLowerCase())
                              )?.[0] ?? "avadaPlaza"
                            );
                            setStep("idle");
                            setTestName("");
                          }}
                        >
                          ➕ Thêm
                        </Button>
                        <button
                          className="text-red-400 hover:text-red-600 px-1 text-xs"
                          onClick={() => void handleDeleteFeature(f.file)}
                          title="Xóa feature"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How-to guide */}
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Hướng dẫn</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Chọn App → đặt tên Feature và Test case</li>
                <li>Nhấn <strong>Bắt đầu Recording</strong> → browser tự mở</li>
                <li>Thực hiện thao tác muốn test (click, nhập, verify...)</li>
                <li>Nhấn <strong>Dừng Recording</strong> → xem lại code</li>
                <li>Nhấn <strong>Lưu</strong> → test được thêm vào feature file</li>
                <li>Nhấn <strong>Thêm test case</strong> để ghi thêm test vào cùng feature</li>
                <li>Dùng <strong>Run Tests</strong> để chạy feature đã ghi</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-bold border-2 ${
        done ? "bg-green-500 border-green-500 text-white" :
        active ? "bg-primary border-primary text-primary-foreground" :
        "bg-background border-border text-muted-foreground"
      }`}>
        {done ? "✓" : " "}
      </div>
      <span className={`text-xs whitespace-nowrap ${active ? "font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
