import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface AppInfo {
  handle: string | null;
}

interface AppsRegistry {
  avadaPlaza?: { name?: string; handle?: string };
  seo?: { name?: string; handle?: string };
  blogs?: { name?: string; handle?: string };
}

interface StatusResponse {
  auth: { ok: boolean; sessionFile: string };
  apps: {
    avadaPlaza: AppInfo;
    seo: AppInfo;
    blogs: AppInfo;
  };
  gateway: { ok: boolean; agentReady: boolean };
  notion: { ok: boolean };
  gitlab: { ok: boolean };
}

function readEnvFile(envPath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    if (!fs.existsSync(envPath)) return env;
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  } catch {
    // ignore
  }
  return env;
}

export async function GET(): Promise<NextResponse<StatusResponse | { error: string }>> {
  try {
    const projectRoot = path.resolve(process.cwd(), "..");

    // --- Auth ---
    const sessionFile = path.resolve(projectRoot, ".auth/session.json");
    const authOk = fs.existsSync(sessionFile);

    // --- Apps registry ---
    const registryPath = path.resolve(
      projectRoot,
      "skills/shopify-test-gen/references/apps-registry.json"
    );
    let registry: AppsRegistry = {};
    try {
      if (fs.existsSync(registryPath)) {
        registry = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as AppsRegistry;
      }
    } catch {
      // ignore parse errors
    }

    // Extract handles — registry may not have "handle" field but has "name"
    // We check if the app is configured (has a name)
    const getHandle = (appData: { name?: string; handle?: string } | undefined): string | null => {
      if (!appData) return null;
      if (appData.handle) return appData.handle;
      if (appData.name) return appData.name;
      return null;
    };

    // --- Env tokens ---
    const envPath = path.resolve(projectRoot, ".env");
    const envLocal = readEnvFile(envPath);
    // Also check process.env (next.js may have loaded them)
    const notionToken = process.env.AVADA_NOTION_TOKEN || envLocal["AVADA_NOTION_TOKEN"] || "";
    const gitlabToken = process.env.GITLAB_TOKEN || envLocal["GITLAB_TOKEN"] || "";

    // --- Gateway ping ---
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
    let gatewayOk = false;
    let agentReady = false;
    try {
      const res = await fetch(`${gatewayUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        gatewayOk = true;
        agentReady = true; // if health passes, assume agent ready
      }
    } catch {
      // unreachable or timeout
    }

    const status: StatusResponse = {
      auth: { ok: authOk, sessionFile: ".auth/session.json" },
      apps: {
        avadaPlaza: { handle: getHandle(registry.avadaPlaza) },
        seo: { handle: getHandle(registry.seo) },
        blogs: { handle: getHandle(registry.blogs) },
      },
      gateway: { ok: gatewayOk, agentReady },
      notion: { ok: Boolean(notionToken) },
      gitlab: { ok: Boolean(gitlabToken) },
    };

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
