"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const suites = [
  { id: "all", name: "All Tests", description: "Run the complete test suite across all apps", icon: "🧪" },
  { id: "avada-plaza", name: "Avada Plaza", description: "Tests for Avada Plaza application", icon: "🏬" },
  { id: "seo", name: "SEO", description: "SEO optimization test suite", icon: "🔍" },
  { id: "blogs", name: "Blogs", description: "Blog functionality tests", icon: "📝" },
  { id: "smoke", name: "Smoke Tests", description: "Quick smoke tests for critical paths", icon: "⚡" },
];

interface HistoryEntry {
  id: string;
  suite: string;
  env: string;
  startedAt: string;
  duration: number;
  passed: number;
  failed: number;
  total: number;
  status: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => setHistory(data.runs || []))
      .catch(() => {});
  }, []);

  const recentRuns = history.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">🎭 Shopify Autotest</h1>
        <p className="text-muted-foreground mt-1">Playwright automation test runner for Shopify apps</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suites.map((suite) => (
          <Card key={suite.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{suite.icon}</span>
                {suite.name}
                {suite.id === "smoke" && (
                  <Badge variant="secondary" className="ml-auto text-xs">Fast</Badge>
                )}
              </CardTitle>
              <CardDescription>{suite.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => router.push(`/run?suite=${suite.id}`)}
              >
                Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Runs</h2>
        {recentRuns.length === 0 ? (
          <p className="text-muted-foreground">No test runs yet. Start by running a test suite above.</p>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={run.status === "passed" ? "default" : "destructive"}>
                    {run.status}
                  </Badge>
                  <span className="font-medium">{run.suite}</span>
                  <span className="text-muted-foreground text-sm">{run.env}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">{run.passed} passed</span>
                  {run.failed > 0 && <span className="text-red-600">{run.failed} failed</span>}
                  <span className="text-muted-foreground">
                    {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "-"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
