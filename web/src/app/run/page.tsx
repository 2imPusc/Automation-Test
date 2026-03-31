"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RunPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <RunPageContent />
    </Suspense>
  );
}

interface LogLine {
  text: string;
  type: "pass" | "fail" | "skip" | "info";
}

interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failedTests: string[];
}

function RunPageContent() {
  const searchParams = useSearchParams();
  const [suite, setSuite] = useState(searchParams.get("suite") || "all");
  const [env, setEnv] = useState("local");
  const [locale, setLocale] = useState("en");
  const [headed, setHeaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleRun = async () => {
    setRunning(true);
    setLogs([]);
    setSummary(null);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite, env, locale, headed }),
      });
      const { runId } = await res.json();

      const eventSource = new EventSource(`/api/run/${runId}/stream`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
          const line = data.text as string;
          let type: LogLine["type"] = "info";
          if (line.startsWith("PASS:")) type = "pass";
          else if (line.startsWith("FAIL:")) type = "fail";
          else if (line.startsWith("SKIP:")) type = "skip";
          setLogs((prev) => [...prev, { text: line, type }]);
        } else if (data.type === "done") {
          setSummary(data.summary);
          setRunning(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setRunning(false);
        eventSource.close();
      };
    } catch {
      setRunning(false);
      setLogs((prev) => [
        ...prev,
        { text: "FAIL: Failed to start test run", type: "fail" },
      ]);
    }
  };

  const getLogColor = (type: LogLine["type"]) => {
    switch (type) {
      case "pass": return "text-green-500";
      case "fail": return "text-red-500";
      case "skip": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Run Tests</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Test Suite</Label>
              <Select value={suite} onValueChange={setSuite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tests</SelectItem>
                  <SelectItem value="avada-plaza">Avada Plaza</SelectItem>
                  <SelectItem value="seo">SEO</SelectItem>
                  <SelectItem value="blogs">Blogs</SelectItem>
                  <SelectItem value="smoke">Smoke Tests</SelectItem>
                  <SelectItem value="recorded">🎬 Recorded Features</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={env} onValueChange={setEnv}>
                <SelectTrigger>
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
              <Label>Ngôn ngữ (Locale)</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger>
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
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={headed}
              onCheckedChange={setHeaded}
            />
            <Label>Headed mode (show browser)</Label>
          </div>

          <Button onClick={handleRun} disabled={running} size="lg" className="w-full">
            {running ? "Running..." : "Run Tests"}
          </Button>
        </CardContent>
      </Card>

      {(logs.length > 0 || running) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Logs
              {running && (
                <Badge variant="secondary" className="animate-pulse">Live</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={logRef}
              className="h-96 overflow-y-auto rounded-lg bg-black p-4 font-mono text-sm"
            >
              {logs.map((log, i) => (
                <div key={i} className={getLogColor(log.type)}>
                  {log.text}
                </div>
              ))}
              {running && (
                <div className="text-muted-foreground animate-pulse">▊</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Results Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{(summary.duration / 1000).toFixed(1)}s</div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
            </div>

            {summary.failedTests.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-600 mb-2">Failed Tests:</h3>
                <ul className="space-y-1">
                  {summary.failedTests.map((test, i) => (
                    <li key={i} className="text-sm text-red-500 font-mono">
                      ✗ {test}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
