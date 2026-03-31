"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TestFileInfo {
  file: string;
  app: string;
  name: string;
  testCount: number;
  hasSmoke: boolean;
  modifiedAt: string;
  size: number;
  isGenerated: boolean;
  meta: {
    taskId?: string;
    taskTitle?: string;
    branch?: string;
    feature?: string;
    generatedAt?: string;
  };
}

interface TestLibraryProps {
  onSelect: (files: string[]) => void;
  onCatalogChange?: () => void; // notify parent after delete
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "vừa xong";
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days}d trước`;
}

export default function TestLibrary({ onSelect, onCatalogChange }: TestLibraryProps) {
  const [files, setFiles] = useState<TestFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "generated" | "manual">("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deleted: string[]; errors: string[] } | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart/test-catalog");
      const data = await res.json();
      setFiles(data.files || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const toggleSelect = (file: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filtered.map(f => f.file);
    if (visible.every(f => selected.has(f))) {
      setSelected(prev => {
        const next = new Set(prev);
        visible.forEach(f => next.delete(f));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        visible.forEach(f => next.add(f));
        return next;
      });
    }
  };

  const handleUseSelected = () => {
    onSelect(Array.from(selected));
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;

    const names = Array.from(selected)
      .map(f => f.split("/").pop()?.replace(".spec.ts", "") ?? f)
      .join("\n• ");

    const confirmed = window.confirm(
      `Xóa ${selected.size} file sau?\n\n• ${names}\n\nFile sẽ được chuyển vào _archive (có thể khôi phục).`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await fetch("/api/smart/test-catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: Array.from(selected) }),
      });
      const result = await res.json() as { deleted: string[]; errors: string[] };
      setDeleteResult(result);

      // Remove deleted files from list + clear selection
      setFiles(prev => prev.filter(f => !result.deleted.includes(f.file)));
      setSelected(prev => {
        const next = new Set(prev);
        result.deleted.forEach(f => next.delete(f));
        return next;
      });

      onCatalogChange?.();
    } catch {
      setDeleteResult({ deleted: [], errors: ["Network error — thử lại"] });
    } finally {
      setDeleting(false);
    }
  };

  // Get unique apps
  const apps = Array.from(new Set(files.map(f => f.app)));

  const filtered = files.filter(f => {
    if (filter === "generated" && !f.isGenerated) return false;
    if (filter === "manual" && f.isGenerated) return false;
    if (appFilter !== "all" && f.app !== appFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
        <span className="animate-spin">⏳</span> Loading test catalog...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Chưa có test file nào. Dùng AI Pipeline để generate.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {(["all", "generated", "manual"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `Tất cả (${files.length})` :
               f === "generated" ? `🤖 AI (${files.filter(x => x.isGenerated).length})` :
               `✍️ Manual (${files.filter(x => !x.isGenerated).length})`}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            variant={appFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAppFilter("all")}
          >
            All apps
          </Button>
          {apps.map(app => (
            <Button
              key={app}
              variant={appFilter === app ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAppFilter(app)}
            >
              {app}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
            {filtered.every(f => selected.has(f.file)) ? "Bỏ chọn" : "Chọn tất cả"}
          </Button>
          {selected.size > 0 && (
            <>
              <Button size="sm" className="h-7" onClick={handleUseSelected}>
                ▶ Chạy {selected.size} file{selected.size > 1 ? "s" : ""}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7"
                onClick={() => void handleDeleteSelected()}
                disabled={deleting}
              >
                {deleting ? "⏳ Đang xóa..." : `🗑 Xóa ${selected.size}`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete feedback */}
      {deleteResult && (
        <div className={`text-xs rounded-md px-3 py-2 ${deleteResult.errors.length > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {deleteResult.deleted.length > 0 && (
            <span>✅ Đã xóa {deleteResult.deleted.length} file (chuyển vào _archive). </span>
          )}
          {deleteResult.errors.map((e, i) => (
            <span key={i} className="block">❌ {e}</span>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {filtered.map(f => (
          <div
            key={f.file}
            className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer transition-colors group ${
              selected.has(f.file) ? "border-blue-300 bg-blue-50" : "hover:bg-muted/50"
            }`}
            onClick={() => toggleSelect(f.file)}
          >
            <input
              type="checkbox"
              checked={selected.has(f.file)}
              onChange={() => toggleSelect(f.file)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs truncate">{f.name}</span>
                {f.isGenerated && <Badge variant="outline" className="text-[10px] h-4 px-1">🤖 AI</Badge>}
                {f.hasSmoke && <Badge variant="outline" className="text-[10px] h-4 px-1 border-green-300 text-green-700">@smoke</Badge>}
              </div>
              <div className="flex gap-2 text-[11px] text-muted-foreground mt-0.5">
                <span>{f.app}</span>
                <span>·</span>
                <span>{f.testCount} tests</span>
                <span>·</span>
                <span>{timeAgo(f.modifiedAt)}</span>
                {f.meta.taskTitle && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[200px]" title={f.meta.taskTitle}>
                      {f.meta.taskTitle}
                    </span>
                  </>
                )}
              </div>
            </div>
            {/* Inline delete button — visible on hover */}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 px-1 text-xs shrink-0"
              title="Xóa file này"
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = window.confirm(`Xóa file "${f.name}"?\n\nFile sẽ chuyển vào _archive.`);
                if (!confirmed) return;
                setDeleting(true);
                setDeleteResult(null);
                try {
                  const res = await fetch("/api/smart/test-catalog", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ files: [f.file] }),
                  });
                  const result = await res.json() as { deleted: string[]; errors: string[] };
                  setDeleteResult(result);
                  if (result.deleted.includes(f.file)) {
                    setFiles(prev => prev.filter(x => x.file !== f.file));
                    setSelected(prev => { const n = new Set(prev); n.delete(f.file); return n; });
                    onCatalogChange?.();
                  }
                } catch {
                  setDeleteResult({ deleted: [], errors: ["Network error"] });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
