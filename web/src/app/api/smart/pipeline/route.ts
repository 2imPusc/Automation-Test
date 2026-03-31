import { NextRequest } from "next/server";
import {
  type PipelineInput,
  collectContext,
  planFlow,
  writeCode,
  sseEncode,
} from "../_shared/pipeline-helpers";

// ── Main Pipeline Route (backward compatible) ───────────────────────────────

export async function POST(request: NextRequest) {
  const input: PipelineInput = await request.json();

  if (!input.notionUrl && !input.manualInput) {
    return new Response(JSON.stringify({ error: "notionUrl hoặc manualInput required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        try { controller.enqueue(encoder.encode(msg)); } catch { /* closed */ }
      };

      try {
        send(sseEncode("start", "🚀 Pipeline started"));

        // Layer 1
        const ctx = await collectContext(input, send);

        // Log resolved handles
        const h = ctx.meta.resolvedHandles;
        const handleKeys = Object.entries(h).filter(([k]) => k.includes("_HANDLE"));
        if (handleKeys.length) {
          for (const [k, v] of handleKeys) {
            send(sseEncode("step", v ? `🎯 ${k}=${v}` : `⚪ ${k} (chưa set)`));
          }
        } else {
          send(sseEncode("step", `🏪 Production handles (no staging override)`));
        }

        send(sseEncode("layer-done", { layer: 1, title: "Context Collector" }));

        // Layer 2
        const plan = await planFlow(ctx, send);
        send(sseEncode("layer-done", { layer: 2, title: "Flow Planner", scenarios: plan.scenarios.length }));

        // Layer 3
        const codeResult = await writeCode(ctx, plan, send);
        send(sseEncode("layer-done", { layer: 3, title: "Code Writer", files: codeResult.files }));

        // Summary
        send(sseEncode("done", {
          files: codeResult.files,
          validated: codeResult.validated,
          plan,
          meta: ctx.meta,
        }));
      } catch (err) {
        send(sseEncode("error", String(err)));
      } finally {
        controller.close();
      }
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
