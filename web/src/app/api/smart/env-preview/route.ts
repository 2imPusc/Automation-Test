import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function parseEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) vars[key] = val;
  }
  return vars;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get("env") || "local";
  const stageNum = searchParams.get("stageNum") || "1";

  const projectRoot = path.resolve(process.cwd(), "..");
  const envVars = parseEnvFile(path.join(projectRoot, ".env"));

  const isStaging = env === "staging";
  const appKeyMap: Record<string, string> = {
    avadaPlaza: "AVADA_PLAZA",
    seo: "SEO",
    blogs: "BLOGS",
  };

  const apps: Record<string, { handle: string; envKey: string; ok: boolean }> = {};

  for (const [key, prefix] of Object.entries(appKeyMap)) {
    const envKey = isStaging
      ? `STAGING_${stageNum}_${prefix}_HANDLE`
      : `${prefix}_HANDLE`;
    const handle = envVars[envKey] || "";
    apps[key] = { handle, envKey, ok: !!handle };
  }

  const storeHandle = envVars.STORE_HANDLE || "";

  // Kiểm tra session file
  const sessionFile = isStaging ? ".auth/session.staging.json" : ".auth/session.json";
  const sessionPath = path.join(projectRoot, sessionFile);
  const sessionFallback = path.join(projectRoot, ".auth/session.json");
  const hasSession = fs.existsSync(sessionPath) || fs.existsSync(sessionFallback);
  let sessionAge = 0;
  const activeSessionPath = fs.existsSync(sessionPath) ? sessionPath : sessionFallback;
  if (fs.existsSync(activeSessionPath)) {
    sessionAge = Math.floor((Date.now() - fs.statSync(activeSessionPath).mtimeMs) / 3600000);
  }
  const sessionExpired = hasSession && sessionAge > 7 * 24;

  return NextResponse.json({
    env,
    stageNum,
    store: storeHandle,
    apps,
    session: {
      ok: hasSession && !sessionExpired,
      file: path.basename(activeSessionPath),
      ageHours: sessionAge,
      expired: sessionExpired,
    },
  });
}
