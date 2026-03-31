import PipelinePanel from "../smart-run/PipelinePanel";

export default function PipelinePage() {
  return (
    <main className="container max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🤖 AI Test Pipeline</h1>
        <p className="text-gray-500 mt-1">
          Paste Notion URL → AI phân tích → tự viết test files → validate
        </p>
        <div className="flex gap-2 mt-2 text-xs text-gray-400">
          <span>Layer 1: Context Collector</span>
          <span>→</span>
          <span>Layer 2: Flow Planner (AI)</span>
          <span>→</span>
          <span>Layer 3: Code Writer (AI + file write)</span>
        </div>
      </div>
      <PipelinePanel />
    </main>
  );
}
