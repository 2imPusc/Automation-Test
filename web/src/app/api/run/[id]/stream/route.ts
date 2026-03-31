import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const runId = params.id;
  const activeRuns = (globalThis as Record<string, unknown>).__activeRuns as Map<
    string,
    { logs: string[]; done: boolean; exitCode: number | null }
  >;

  if (!activeRuns?.has(runId)) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let sentIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const run = activeRuns.get(runId);
        if (!run) {
          clearInterval(interval);
          controller.close();
          return;
        }

        // Send new log lines
        while (sentIndex < run.logs.length) {
          const line = run.logs[sentIndex];
          const logType = line.startsWith("STEP:") ? "step" : "log";
          const data = JSON.stringify({ type: logType, text: line });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          sentIndex++;
        }

        // Send done event
        if (run.done) {
          clearInterval(interval);
          const passed = run.logs.filter((l) => l.startsWith("PASS:")).length;
          const failed = run.logs.filter((l) => l.startsWith("FAIL:")).length;
          const skipped = run.logs.filter((l) => l.startsWith("SKIP:")).length;
          const failedTests = run.logs
            .filter((l) => l.startsWith("FAIL:"))
            .map((l) => l.replace("FAIL: ", ""));

          const summary = {
            total: passed + failed + skipped,
            passed,
            failed,
            skipped,
            duration: 0,
            failedTests,
            exitCode: run.exitCode,
          };

          const data = JSON.stringify({ type: "done", summary });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        }
      }, 100);

      // Clean up if client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
