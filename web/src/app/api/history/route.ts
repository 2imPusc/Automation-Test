import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET() {
  const historyPath = path.join(DATA_DIR, "history.json");
  try {
    if (fs.existsSync(historyPath)) {
      const data = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      return NextResponse.json(data);
    }
  } catch {
    // ignore
  }
  return NextResponse.json({ runs: [] });
}
