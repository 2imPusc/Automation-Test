import { NextRequest } from "next/server";
import {
  type PipelineContext,
  type FlowPlan,
  writeCode,
  sseEncode,
} from "../_shared/pipeline-helpers";

interface GenerateInput {
  plan: FlowPlan;
  pipelineContext: PipelineContext;
}

/**
 * POST /api/smart/generate
 * Phase 2: Code Writer AI — takes confirmed plan + context, returns SSE stream.
 */
export async function POST(request: NextRequest) {
  const input: GenerateInput = await request.json();

  if (!input.plan || !input.pipelineContext) {
    return new Response(JSON.stringify({ error: "plan và pipelineContext required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        try { controller.enqueue(encoder.encode(msg)); } catch { /* closed */ }
      };

      try {
        send(sseEncode("start", "🚀 Code generation started"));

        // Layer 3: Code Writer
        const codeResult = await writeCode(input.pipelineContext, input.plan, send);
        send(sseEncode("layer-done", { layer: 3, title: "Code Writer", files: codeResult.files }));

        send(sseEncode("done", {
          files: codeResult.files,
          validated: codeResult.validated,
          plan: input.plan,
          meta: input.pipelineContext.meta,
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
