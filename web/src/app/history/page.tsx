"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function HistoryPage() {
  const [runs, setRuns] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => setRuns(data.runs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Test History</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading history...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <p className="text-lg">No test runs recorded yet</p>
          <p className="text-sm">Run a test suite from <a href="/run" className="text-primary underline">Run Tests</a> or <a href="/smart-run" className="text-primary underline">Smart Run</a> to see results here.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{run.suite}</TableCell>
                  <TableCell>{run.env}</TableCell>
                  <TableCell>
                    <Badge variant={run.status === "passed" ? "default" : "destructive"}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-green-600">{run.passed}</TableCell>
                  <TableCell className="text-right text-red-600">{run.failed}</TableCell>
                  <TableCell className="text-right">{run.total}</TableCell>
                  <TableCell className="text-right">
                    {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
