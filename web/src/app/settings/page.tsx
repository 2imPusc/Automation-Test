"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Settings {
  storeHandle: string;
  notionApiToken: string;
  timeout: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    storeHandle: "",
    notionApiToken: "",
    timeout: 30000,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Store Handle</Label>
            <Input
              placeholder="your-store-handle"
              value={settings.storeHandle}
              onChange={(e) =>
                setSettings((s) => ({ ...s, storeHandle: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Shopify Admin URL: admin.shopify.com/store/<strong>[handle]</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notion API Token</Label>
            <Input
              type="password"
              placeholder="secret_..."
              value={settings.notionApiToken}
              onChange={(e) =>
                setSettings((s) => ({ ...s, notionApiToken: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Internal integration token cho Avada workspace
            </p>
          </div>

          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              value={settings.timeout}
              onChange={(e) =>
                setSettings((s) => ({ ...s, timeout: parseInt(e.target.value) || 30000 }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Thời gian chờ tối đa cho mỗi test action (mặc định: 30000ms)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
            </Button>
            {saved && <span className="text-sm text-green-600">Settings saved successfully</span>}
          </div>

          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground space-y-1 mt-2">
            <p className="font-medium text-foreground">App handles & tokens</p>
            <p>
              App handles (AVADA_PLAZA_HANDLE, SEO_HANDLE...), GitLab token, và staging handles
              được cấu hình trong file <code className="bg-muted px-1 py-0.5 rounded text-xs">.env</code> ở thư mục gốc dự án.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
