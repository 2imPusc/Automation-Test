import { NextRequest, NextResponse } from "next/server";

function parseMrUrl(mrUrl: string): { projectPath: string; mrIid: string } | null {
  const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!match) return null;
  return { projectPath: match[1], mrIid: match[2] };
}

export async function POST(request: NextRequest) {
  try {
    const { mrContent } = await request.json();

    if (!mrContent) {
      return NextResponse.json({ isMock: true, noUrl: true });
    }

    const mrUrlMatch = mrContent.match(/https?:\/\/[^\s]+\/merge_requests\/\d+/);
    if (!mrUrlMatch) {
      return NextResponse.json({ isMock: true, noUrl: true });
    }

    const mrUrl = mrUrlMatch[0];
    const parsed = parseMrUrl(mrUrl);
    if (!parsed) {
      return NextResponse.json({ isMock: true, noUrl: true });
    }

    const token = process.env.GITLAB_TOKEN;
    const gitlabUrl = process.env.GITLAB_URL || "https://gitlab.com";

    if (!token) {
      return NextResponse.json({ isMock: true, noToken: true, mrUrl });
    }

    const { projectPath, mrIid } = parsed;
    const encoded = encodeURIComponent(projectPath);

    // Lấy MR info
    const mrRes = await fetch(
      `${gitlabUrl}/api/v4/projects/${encoded}/merge_requests/${mrIid}`,
      { headers: { "PRIVATE-TOKEN": token } }
    );

    if (!mrRes.ok) {
      return NextResponse.json({ isMock: true, mrUrl, reason: `GitLab API: ${mrRes.status}` });
    }

    const mrData = await mrRes.json();

    // Lấy diff (tối đa 50 files)
    const diffRes = await fetch(
      `${gitlabUrl}/api/v4/projects/${encoded}/merge_requests/${mrIid}/diffs?per_page=50`,
      { headers: { "PRIVATE-TOKEN": token } }
    );

    let diff = "";
    if (diffRes.ok) {
      const diffs = await diffRes.json();
      const relevant = (diffs || [])
        .filter((d: { new_path: string }) =>
          /\.(tsx?|jsx?)$/.test(d.new_path) &&
          !/node_modules|dist\/|build\/|\.next/.test(d.new_path)
        )
        .slice(0, 10);
      diff = relevant
        .map((d: { new_path: string; diff: string }) => `// ${d.new_path}\n${d.diff}`)
        .join("\n\n")
        .slice(0, 8000);
    }

    return NextResponse.json({
      branch: mrData.source_branch,
      title: mrData.title,
      description: mrData.description || "",
      author: mrData.author?.name || mrData.author?.username || "",
      state: mrData.state,
      mrIid,
      projectPath,
      diff,
      isMock: false,
    });
  } catch (error) {
    return NextResponse.json(
      { isMock: true, reason: String(error) },
      { status: 500 }
    );
  }
}
