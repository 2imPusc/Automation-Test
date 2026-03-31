import { NextRequest, NextResponse } from "next/server";

// Extract test name from full path like:
// "1 [chromium] › tests/avada-plaza/basic.spec.ts:16:7 › Avada Plaza - Kiểm tra cơ bản"
// → "Avada Plaza - Kiểm tra cơ bản"
function extractTestName(raw: string): string {
  const parts = raw.split("›");
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return raw.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { notionPageId, results } = await request.json();

    const token = process.env.AVADA_NOTION_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "AVADA_NOTION_TOKEN is not configured" },
        { status: 500 }
      );
    }

    if (!notionPageId) {
      return NextResponse.json(
        { error: "notionPageId is required" },
        { status: 400 }
      );
    }

    const { passed = 0, failed = 0, total = 0, duration = 0, failedTests = [] } = results || {};

    // Format date: DD/MM/YYYY HH:MM
    const now = new Date();
    const datePart = now.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const formattedDate = `${datePart} ${timePart}`;

    const statusEmoji = failed > 0 ? "🔴" : "🟢";
    const durationStr = (duration / 1000).toFixed(1);

    // Callout content:
    // 🔴 Test Results — 23/03/2026 11:25
    // ✅ Passed: 14/29  ❌ Failed: 15  ⏱ 45.2s
    const calloutLine1 = `${statusEmoji} Test Results — ${formattedDate}`;
    const calloutLine2 = `✅ Passed: ${passed}/${total}  ❌ Failed: ${failed}  ⏱ ${durationStr}s`;

    // Build children blocks
    const children: Record<string, unknown>[] = [
      // Separator before callout
      {
        object: "block",
        type: "divider",
        divider: {},
      },
      // Callout block
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: [
            {
              type: "text",
              text: { content: calloutLine1 + "\n" + calloutLine2 },
            },
          ],
          icon: { type: "emoji", emoji: failed > 0 ? "🔴" : "✅" },
          color: failed > 0 ? "red_background" : "green_background",
        },
      },
    ];

    // Each failed test as its own bulleted_list_item
    if (failedTests.length > 0) {
      for (const test of failedTests as string[]) {
        const testName = extractTestName(test);
        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: testName },
                annotations: { color: "red" },
              },
            ],
          },
        });
      }
    }

    const blockRes = await fetch(
      `https://api.notion.com/v1/blocks/${notionPageId}/children`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ children }),
      }
    );

    if (!blockRes.ok) {
      const errText = await blockRes.text();
      return NextResponse.json(
        { error: "Failed to append result block to Notion", details: errText },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update Notion", details: String(error) },
      { status: 500 }
    );
  }
}
