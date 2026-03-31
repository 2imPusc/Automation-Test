"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

export interface Scenario {
  name: string;
  description?: string;
  type: string;
  priority: string;
  steps: string[];
  assertions: string[];
  needsSourceFiles?: string[];
  tags?: string[];
}

export interface PipelineStep {
  type: string;
  text?: string;
  name?: string;
  layer?: number;
  title?: string;
  scenarios?: number;
  files?: string[];
  priority?: string;
  steps?: number;
  plan?: {
    targetPage: string;
    scenarios: Scenario[];
    pomAction: string;
  };
  meta?: { appKey: string; branch: string };
  validated?: boolean;
}

export interface ManualInput {
  app: string;       // e.g. "avadaPlaza"
  branch: string;    // e.g. "master" or "feature/xyz"
  title: string;     // task title / tên tính năng cần test
  description: string; // mô tả flow từ tester
  bugs?: string;     // bugs cần regression (optional)
}

interface PlanResponse {
  plan: {
    targetPage: string;
    featureFile: string;
    scenarios: Scenario[];
    pomAction: string;
    existingPom: string | null;
    notes?: string;
  };
  context: {
    appKey: string;
    appName: string;
    branch: string;
    featureFileName: string;
    taskId: string;
    pageId: string;
    title: string;
  };
  _pipelineContext: unknown;
  logs: string[];
}

interface PipelineState {
  running: boolean;
  steps: PipelineStep[];
  result: PipelineStep | null;
  error: string | null;
  notionUrl: string;
  stageNum: string;
  manualInput: ManualInput | null;
  // Phase 1: Test Plan
  testPlan: Scenario[] | null;
  confirmedPlan: Scenario[] | null;
  planLoading: boolean;
  planError: string | null;
  planContext: PlanResponse | null;
}

interface PipelineContextValue extends PipelineState {
  setNotionUrl: (url: string) => void;
  setStageNum: (n: string) => void;
  setManualInput: (input: ManualInput | null) => void;
  runPipeline: () => Promise<void>;
  stopPipeline: () => void;
  resetPipeline: () => void;
  // 2-phase flow
  generatePlan: () => Promise<void>;
  confirmPlan: (scenarios: Scenario[]) => void;
  generateCode: () => Promise<void>;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [result, setResult] = useState<PipelineStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notionUrl, setNotionUrl] = useState("");
  const [stageNum, setStageNum] = useState("1");
  const [manualInput, setManualInput] = useState<ManualInput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Phase 1: Test Plan states
  const [testPlan, setTestPlan] = useState<Scenario[] | null>(null);
  const [confirmedPlan, setConfirmedPlan] = useState<Scenario[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planContext, setPlanContext] = useState<PlanResponse | null>(null);

  // Legacy 1-shot pipeline (backward compatible)
  const runPipeline = useCallback(async () => {
    if (!notionUrl && !manualInput) return;

    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/smart/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionUrl: notionUrl || undefined,
          manualInput: manualInput || undefined,
          env: "staging",
          stageNum: parseInt(stageNum),
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setError(`Pipeline error: ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data: PipelineStep = JSON.parse(line.slice(6));
            if (data.type === "error") {
              setError(data.text || "Unknown error");
            } else if (data.type === "done") {
              setResult(data);
            } else {
              setSteps(prev => [...prev, data]);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [notionUrl, stageNum, manualInput]);

  // Phase 1: Generate test plan only
  const generatePlan = useCallback(async () => {
    if (!notionUrl && !manualInput) return;

    setPlanLoading(true);
    setPlanError(null);
    setTestPlan(null);
    setConfirmedPlan(null);
    setPlanContext(null);

    try {
      const res = await fetch("/api/smart/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionUrl: notionUrl || undefined,
          manualInput: manualInput || undefined,
          env: "staging",
          stageNum: parseInt(stageNum),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Plan error: ${res.status}`);
      }

      const data: PlanResponse = await res.json();
      setTestPlan(data.plan.scenarios);
      setPlanContext(data);
    } catch (err) {
      setPlanError(String(err));
    } finally {
      setPlanLoading(false);
    }
  }, [notionUrl, stageNum, manualInput]);

  // Phase 1→2: Confirm edited plan
  const confirmPlan = useCallback((scenarios: Scenario[]) => {
    setConfirmedPlan(scenarios);
  }, []);

  // Phase 2: Generate code from confirmed plan
  const generateCode = useCallback(async () => {
    if (!confirmedPlan || !planContext) return;

    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // Build the plan object with confirmed scenarios
      const plan = {
        ...planContext.plan,
        scenarios: confirmedPlan,
      };

      const res = await fetch("/api/smart/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          pipelineContext: planContext._pipelineContext,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setError(`Generate error: ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data: PipelineStep = JSON.parse(line.slice(6));
            if (data.type === "error") {
              setError(data.text || "Unknown error");
            } else if (data.type === "done") {
              setResult(data);
            } else {
              setSteps(prev => [...prev, data]);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [confirmedPlan, planContext]);

  const stopPipeline = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetPipeline = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setSteps([]);
    setResult(null);
    setError(null);
    setTestPlan(null);
    setConfirmedPlan(null);
    setPlanLoading(false);
    setPlanError(null);
    setPlanContext(null);
  }, []);

  return (
    <PipelineContext.Provider value={{
      running, steps, result, error, notionUrl, stageNum, manualInput,
      testPlan, confirmedPlan, planLoading, planError, planContext,
      setNotionUrl, setStageNum, setManualInput,
      runPipeline, stopPipeline, resetPipeline,
      generatePlan, confirmPlan, generateCode,
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}
