import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

const DEFAULT_SETTINGS = {
  storeHandle: "",
  notionApiToken: "",
  timeout: 30000,
};

export async function GET() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      return NextResponse.json({ ...DEFAULT_SETTINGS, ...data });
    }
  } catch {
    // ignore
  }
  return NextResponse.json(DEFAULT_SETTINGS);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const settings = {
    storeHandle: body.storeHandle || "",
    notionApiToken: body.notionApiToken || "",
    timeout: body.timeout || 30000,
  };

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json(settings);
}
