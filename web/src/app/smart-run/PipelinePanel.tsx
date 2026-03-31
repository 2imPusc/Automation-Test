"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePipeline, PipelineStep } from "@/context/PipelineContext";

interface ManualInputProps {
  app: string;
  branch: string;
  title: string;
  description: string;
  bugs?: string;
}

interface PipelinePanelProps {
  /** Pre-fill Notion URL from parent (Smart Run step 1) */
  notionUrl?: string;
  /** Manual input from tester (alternative to notionUrl) */
  manualInput?: ManualInputProps;
  /** Pre-fill staging number from parent */
  stageNum?: string;
  /** Called when pipeline finishes and files were created */
  onFilesGenerated?: (files: string[], plan: PipelineStep["plan"]) => void;
  /** Hide the Notion URL + staging inputs (when controlled by parent) */
  hideInputs?: boolean;
}

const CATEGORY_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  selector: { emoji: "🎯", label: "Selector", color: "text-purple-700 bg-purple-50" },
  timing: { emoji: "⏱️", label: "Timing", color: "text-yellow-700 bg-yellow-50" },
  state: { emoji: "🔄", label: "State", color: "text-blue-700 bg-blue-50" },
  auth: { emoji: "🔐", label: "Auth", color: "text-red-700 bg-red-50" },
  env: { emoji: "⚙️", label: "Environment", color: "text-orange-700 bg-orange-50" },
  "app-bug": { emoji: "🐛", label: "App Bug", color: "text-red-700 bg-red-50" },
  "test-bug": { emoji: "🧪", label: "Test Bug", color: "text-amber-700 bg-amber-50" },
  unknown: { emoji: "❓", label: "Unknown", color: "text-gray-700 bg-gray-50" },
};

export default function PipelinePanel({
  notionUrl: notionUrlProp,
  manualInput: manualInputProp,
  stageNum: stageNumProp,
  onFilesGenerated,
  hideInputs = false,
}: PipelinePanelProps) {
  const {
    running, steps, result, error,
    notionUrl, stageNum,
    setNotionUrl, setStageNum, setManualInput,
    runPipeline, stopPipeline,
  } = usePipeline();

  // Sync props → context when parent provides them
  useEffect(() => {
    if (notionUrlProp !== undefined && notionUrlProp !== notionUrl) {
      setNotionUrl(notionUrlProp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionUrlProp]);

  useEffect(() => {
    if (manualInputProp !== undefined) {
      setManualInput(manualInputProp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualInputProp]);

  useEffect(() => {
    if (stageNumProp !== undefined && stageNumProp !== stageNum) {
      setStageNum(stageNumProp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNumProp]);

  // Notify parent when files are ready
  useEffect(() => {
    if (result?.type === "done" && result.files && result.files.length > 0 && onFilesGenerated) {
      onFilesGenerated(result.files, result.plan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Inputs — standalone mode */}
      {!hideInputs && (
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-0">
            <Label>Notion Task URL</Label>
            <Input
              value={notionUrl}
              onChange={e => setNotionUrl(e.target.value)}
              placeholder="https://www.notion.so/..."
              disabled={running}
            />
          </div>
          <div>
            <Label>Staging #</Label>
            <Input
              value={stageNum}
              onChange={e => setStageNum(e.target.value)}
              className="w-20"
              disabled={running}
            />
          </div>
          <Button
            onClick={running ? stopPipeline : runPipeline}
            disabled={!notionUrl && !running}
            variant={running ? "destructive" : "default"}
          >
            {running ? "⏹ Stop" : "▶ Run Pipeline"}
          </Button>
        </div>
      )}

      {/* Run button — embedded/controlled mode */}
      {hideInputs && (
        <Button
          onClick={running ? stopPipeline : runPipeline}
          disabled={!notionUrl && !running}
          variant={running ? "destructive" : "default"}
          className="w-full"
          size="lg"
        >
          {running ? "⏹ Stop Pipeline" : "🤖 Run AI Pipeline — Generate & Write Tests"}
        </Button>
      )}

      {/* Progress log */}
      {steps.length > 0 && (
        <div className="space-y-1 rounded-lg border bg-zinc-950 p-3 font-mono text-sm max-h-72 overflow-y-auto">
          {steps.map((step, i) => (
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
              {step.type === "scenario" && (
                <span className="text-blue-400">
                  📋 {step.name}{" "}
                  <span className="text-zinc-500">({step.priority} · {step.steps} steps)</span>
                </span>
              )}
              {step.type === "layer-done" && (
                <span className="text-green-400 font-semibold">
                  ✅ Layer {step.layer}: {step.title}
                  {step.scenarios != null && ` (${step.scenarios} scenarios)`}
                  {step.files?.length ? ` → ${step.files.join(", ")}` : ""}
                </span>
              )}
            </div>
          ))}
          {running && <div className="text-zinc-500 animate-pulse">▌</div>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-mono whitespace-pre-wrap">
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 space-y-3 ${result.files && result.files.length > 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {result.files && result.files.length > 0 ? (
            <>
              <div>
                <p className="font-semibold text-green-800">✅ Files created:</p>
                <ul className="mt-1 list-disc list-inside text-sm font-mono">
                  {result.files.map((f, i) => (
                    <li key={i} className="text-green-700">{f}</li>
                  ))}
                </ul>
              </div>
              <Badge variant={result.validated ? "default" : "destructive"}>
                {result.validated ? "✅ Syntax OK" : "⚠️ Needs manual fix"}
              </Badge>
            </>
          ) : (
            <p className="text-amber-700">⚠️ No test files were created. Check logs above.</p>
          )}

          {/* Standalone action buttons */}
          {!onFilesGenerated && result.files && result.files.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                window.open(`/smart-run?autoRun=true&testFiles=${encodeURIComponent(result.files!.join(","))}&env=staging&stageNum=${stageNum}`, "_self");
              }}
            >
              ▶ Run Tests in Smart Run
            </Button>
          )}

          {result.plan && (
            <div>
              <p className="font-semibold text-sm">Test Plan ({result.plan.scenarios.length} scenarios):</p>
              <div className="space-y-1 mt-2">
                {result.plan.scenarios.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-white rounded p-2 border">
                    <Badge variant="outline" className="text-xs">{s.type}</Badge>
                    <Badge variant={s.priority === "high" ? "destructive" : "outline"} className="text-xs">{s.priority}</Badge>
                    <span>{s.name}</span>
                    <span className="text-gray-400 text-xs ml-auto">{s.steps.length} steps</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Running indicator — shown when user is on another page */}
      {running && steps.length === 0 && (
        <div className="text-sm text-zinc-500 flex items-center gap-2">
          <span className="animate-pulse">●</span> Pipeline đang chạy nền...
        </div>
      )}
    </div>
  );
}
