"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Scenario } from "@/context/PipelineContext";

interface TestPlanEditorProps {
  scenarios: Scenario[];
  onConfirm: (confirmedScenarios: Scenario[]) => void;
  loading?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  smoke: "bg-green-100 text-green-800",
  regression: "bg-blue-100 text-blue-800",
  guard: "bg-yellow-100 text-yellow-800",
  "edge-case": "bg-purple-100 text-purple-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-gray-100 text-gray-800",
};

export default function TestPlanEditor({ scenarios: initialScenarios, onConfirm, loading }: TestPlanEditorProps) {
  const [scenarios, setScenarios] = useState<(Scenario & { selected: boolean })[]>(
    initialScenarios.map(s => ({ ...s, selected: true }))
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const updateScenario = (index: number, updates: Partial<Scenario & { selected: boolean }>) => {
    setScenarios(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeScenario = (index: number) => {
    setScenarios(prev => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const addScenario = () => {
    const newScenario: Scenario & { selected: boolean } = {
      name: "",
      description: "",
      type: "regression",
      priority: "medium",
      steps: [""],
      assertions: [""],
      needsSourceFiles: [],
      selected: true,
    };
    setScenarios(prev => [...prev, newScenario]);
    setExpandedIndex(scenarios.length);
  };

  const addListItem = (index: number, field: "steps" | "assertions") => {
    const s = scenarios[index];
    updateScenario(index, { [field]: [...s[field], ""] });
  };

  const removeListItem = (index: number, field: "steps" | "assertions", itemIndex: number) => {
    const s = scenarios[index];
    updateScenario(index, { [field]: s[field].filter((_, i) => i !== itemIndex) });
  };

  const updateListItem = (index: number, field: "steps" | "assertions", itemIndex: number, value: string) => {
    const s = scenarios[index];
    const updated = [...s[field]];
    updated[itemIndex] = value;
    updateScenario(index, { [field]: updated });
  };

  const selectedCount = scenarios.filter(s => s.selected).length;

  const handleConfirm = () => {
    const confirmed = scenarios
      .filter(s => s.selected)
      .map(({ selected: _, ...rest }) => rest);
    onConfirm(confirmed);
  };

  return (
    <div className="space-y-3">
      {scenarios.map((scenario, index) => (
        <Card key={index} className={`transition-all ${!scenario.selected ? "opacity-50" : ""}`}>
          <CardContent className="p-4 space-y-3">
            {/* Header row */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={scenario.selected}
                onChange={(e) => updateScenario(index, { selected: e.target.checked })}
                className="h-4 w-4 mt-1 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{scenario.name || "(chưa đặt tên)"}</span>
                  <Badge className={`text-xs ${TYPE_COLORS[scenario.type] || "bg-gray-100"}`}>
                    {scenario.type}
                  </Badge>
                  <Badge className={`text-xs ${PRIORITY_COLORS[scenario.priority] || "bg-gray-100"}`}>
                    {scenario.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {scenario.steps.length} steps · {scenario.assertions.length} assertions
                  </span>
                </div>
                {scenario.description && expandedIndex !== index && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  {expandedIndex === index ? "Thu gọn" : "Sửa"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeScenario(index)}
                >
                  Xoá
                </Button>
              </div>
            </div>

            {/* Expanded editor */}
            {expandedIndex === index && (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Tên scenario</Label>
                  <Input
                    value={scenario.name}
                    onChange={(e) => updateScenario(index, { name: e.target.value })}
                    placeholder="VD: Optimize all — no confirmation modal"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Mô tả (Vietnamese)</Label>
                  <textarea
                    className="textarea"
                    value={scenario.description || ""}
                    onChange={(e) => updateScenario(index, { description: e.target.value })}
                    placeholder="Mô tả test case cho tester: test cái gì, kỳ vọng kết quả gì"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={scenario.type} onValueChange={(v) => updateScenario(index, { type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smoke">smoke</SelectItem>
                        <SelectItem value="regression">regression</SelectItem>
                        <SelectItem value="guard">guard</SelectItem>
                        <SelectItem value="edge-case">edge-case</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Select value={scenario.priority} onValueChange={(v) => updateScenario(index, { priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">high</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="low">low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-1">
                  <Label className="text-xs">Steps</Label>
                  <div className="space-y-1">
                    {scenario.steps.map((step, si) => (
                      <div key={si} className="flex gap-1 items-center">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{si + 1}.</span>
                        <Input
                          value={step}
                          onChange={(e) => updateListItem(index, "steps", si, e.target.value)}
                          placeholder="VD: Navigate to Image Manager"
                          className="text-sm h-8"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 shrink-0"
                          onClick={() => removeListItem(index, "steps", si)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addListItem(index, "steps")}>
                      + Thêm step
                    </Button>
                  </div>
                </div>

                {/* Assertions */}
                <div className="space-y-1">
                  <Label className="text-xs">Assertions</Label>
                  <div className="space-y-1">
                    {scenario.assertions.map((assertion, ai) => (
                      <div key={ai} className="flex gap-1 items-center">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">✓</span>
                        <Input
                          value={assertion}
                          onChange={(e) => updateListItem(index, "assertions", ai, e.target.value)}
                          placeholder="VD: Toast message visible within 5s"
                          className="text-sm h-8"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 shrink-0"
                          onClick={() => removeListItem(index, "assertions", ai)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addListItem(index, "assertions")}>
                      + Thêm assertion
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add scenario */}
      <Button variant="outline" className="w-full" onClick={addScenario}>
        + Thêm scenario
      </Button>

      {/* Confirm button */}
      <Button
        className="w-full"
        size="lg"
        disabled={selectedCount === 0 || loading}
        onClick={handleConfirm}
      >
        {loading
          ? "Đang generate code..."
          : `Xác nhận — Generate Code (${selectedCount} scenario${selectedCount > 1 ? "s" : ""})`
        }
      </Button>
    </div>
  );
}
