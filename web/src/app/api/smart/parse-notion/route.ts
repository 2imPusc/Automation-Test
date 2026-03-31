import { NextRequest, NextResponse } from "next/server";

function extractPageId(url: string): string | null {
  // Handle formats:
  // notion.so/workspace/Page-Title-PAGE_ID
  // notion.so/PAGE_ID?v=xxx
  // notion.so/workspace/PAGE_ID
  const match = url.match(/([a-f0-9]{32})/);
  if (match) return match[1];

  // Try format with dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const dashMatch = url.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
  );
  if (dashMatch) return dashMatch[1].replace(/-/g, "");

  return null;
}

function getPropertyValue(property: Record<string, unknown>): string {
  const type = property.type as string;
  switch (type) {
    case "title":
      return (
        (property.title as Array<{ plain_text: string }>)
          ?.map((t) => t.plain_text)
          .join("") || ""
      );
    case "rich_text":
      return (
        (property.rich_text as Array<{ plain_text: string }>)
          ?.map((t) => t.plain_text)
          .join("") || ""
      );
    case "select":
      return (property.select as { name: string } | null)?.name || "";
    case "multi_select":
      return (
        (property.multi_select as Array<{ name: string }>)
          ?.map((s) => s.name)
          .join(", ") || ""
      );
    case "status":
      return (property.status as { name: string } | null)?.name || "";
    case "people":
      return (
        (property.people as Array<{ name: string }>)
          ?.map((p) => p.name)
          .join(", ") || ""
      );
    case "url":
      return (property.url as string) || "";
    default:
      return "";
  }
}

async function fetchNotionPage(pageId: string, token: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) {
    throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchNotionBlocks(pageId: string, token: string) {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    }
  );
  if (!res.ok) return { results: [] };
  return res.json();
}

function blocksToText(
  blocks: Array<{ type: string; [key: string]: unknown }>
): string {
  return blocks
    .map((block) => {
      const content = block[block.type] as {
        rich_text?: Array<{ plain_text: string }>;
      };
      if (content?.rich_text) {
        return content.rich_text.map((t) => t.plain_text).join("");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { notionUrl } = await request.json();

    if (!notionUrl) {
      return NextResponse.json(
        { error: "Notion URL is required" },
        { status: 400 }
      );
    }

    const token = process.env.AVADA_NOTION_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "AVADA_NOTION_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const pageId = extractPageId(notionUrl);
    if (!pageId) {
      return NextResponse.json(
        { error: "Could not extract page ID from URL" },
        { status: 400 }
      );
    }

    const [page, blocksData] = await Promise.all([
      fetchNotionPage(pageId, token),
      fetchNotionBlocks(pageId, token),
    ]);

    const props = page.properties || {};

    // Extract known properties (case-insensitive search)
    const findProp = (names: string[]) => {
      for (const name of names) {
        const key = Object.keys(props).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        if (key) return props[key];
      }
      return null;
    };

    // Title: tìm theo tên phổ biến, fallback tìm bất kỳ field type=title
    const titlePropNames = ["name", "title", "task", "Name", "Title", "focus mode", "Focus mode"];
    let titleProp = findProp(titlePropNames);
    if (!titleProp) {
      // Fallback: tìm field có type = "title"
      const titleEntry = Object.values(props).find((p) => (p as Record<string, unknown>).type === "title");
      if (titleEntry) titleProp = titleEntry as Record<string, unknown>;
    }
    const title = getPropertyValue(titleProp || { type: "title", title: [] });
    const app = getPropertyValue(
      findProp(["app", "apps", "App", "Apps"]) || {
        type: "multi_select",
        multi_select: [],
      }
    );
    const status = getPropertyValue(
      findProp(["status", "Status"]) || { type: "status", status: null }
    );
    const assignees = getPropertyValue(
      findProp(["assign", "assignee", "Assign", "Assignee", "assignees"]) || {
        type: "people",
        people: [],
      }
    );
    const mr = getPropertyValue(
      findProp(["mr", "MR", "merge request", "Merge Request", "gitlab"]) || {
        type: "rich_text",
        rich_text: [],
      }
    );

    const description = blocksToText(blocksData.results || []);

    // Parse GitLab MR info
    let gitlabInfo = { isMock: true, noUrl: true };
    if (mr) {
      try {
        const gitlabRes = await fetch(
          new URL("/api/smart/parse-gitlab", request.url).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mrContent: mr }),
          }
        );
        gitlabInfo = await gitlabRes.json();
      } catch {
        // Ignore gitlab parse errors
      }
    }

    return NextResponse.json({
      pageId,
      title,
      description: description.slice(0, 2000),
      app,
      status,
      assignees,
      mr,
      gitlabInfo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse Notion page", details: String(error) },
      { status: 500 }
    );
  }
}
