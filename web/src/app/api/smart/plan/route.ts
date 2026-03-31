import { NextRequest } from "next/server";
import {
  type PipelineInput,
  type PipelineContext,
  type FlowPlan,
  collectContext,
  planFlow,
  sseEncode,
} from "../_shared/pipeline-helpers";

/**
 * POST /api/smart/plan
 * Phase 1: Context collection + Flow Planner AI → returns test plan JSON.
 * NOT SSE — plain JSON response.
 */
export async function POST(request: NextRequest) {
  const input: PipelineInput = await request.json();

  if (!input.notionUrl && !input.manualInput) {
    return new Response(JSON.stringify({ error: "notionUrl hoặc manualInput required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Collect logs for debugging
    const logs: string[] = [];
    const logStream = (msg: string) => {
      // Extract text from SSE format
      const match = msg.match(/data: (.+)\n\n/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          if (data.text) logs.push(data.text);
        } catch { /* ignore */ }
      }
    };

    // Layer 1: Context collection
    const ctx: PipelineContext = await collectContext(input, logStream);

    // Layer 2: Flow planner
    const plan: FlowPlan = await planFlow(ctx, logStream);

    // Return plan + context metadata for Phase 2
    return new Response(JSON.stringify({
      plan,
      context: {
        appKey: ctx.meta.appKey,
        appName: ctx.meta.appName,
        branch: ctx.meta.branch,
        featureFileName: ctx.context.featureFileName,
        taskId: ctx.meta.taskId,
        pageId: ctx.notion.pageId,
        title: ctx.notion.title,
      },
      // Pass full ctx serialized for generate phase
      _pipelineContext: ctx,
      logs,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
