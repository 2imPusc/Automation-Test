import { NextRequest, NextResponse } from "next/server";

function parseMrUrl(mrUrl: string): { projectPath: string; mrIid: string } | null {
  const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!match) return null;
  return { projectPath: match[1], mrIid: match[2] };
}

function encodeProjectPath(path: string): string {
  return encodeURIComponent(path);
}

async function gitlabGet(url: string, token: string) {
  const res = await fetch(url, {
    headers: { "PRIVATE-TOKEN": token },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { mrUrl, stageNum, expectedBranch } = await request.json();

    const token = process.env.GITLAB_TOKEN;
    const gitlabUrl = process.env.GITLAB_URL || "https://gitlab.com";

    if (!token) {
      return NextResponse.json({ found: false, reason: "GITLAB_TOKEN not configured" });
    }

    if (!mrUrl || !stageNum) {
      return NextResponse.json({ found: false, reason: "mrUrl and stageNum required" });
    }

    const parsed = parseMrUrl(mrUrl);
    if (!parsed) {
      return NextResponse.json({ found: false, reason: "Cannot parse MR URL" });
    }

    const { projectPath } = parsed;
    const encoded = encodeProjectPath(projectPath);

    // Tên environment: đọc từ env var trước, fallback staging-N
    const envName = process.env[`STAGING_${stageNum}_ENV_NAME`] || `staging-${stageNum}`;

    // Query deployments
    const deploymentsUrl = `${gitlabUrl}/api/v4/projects/${encoded}/deployments?environment=${envName}&order_by=created_at&sort=desc&per_page=1`;
    const deployments = await gitlabGet(deploymentsUrl, token);

    if (!deployments || !Array.isArray(deployments) || deployments.length === 0) {
      return NextResponse.json({
        found: false,
        reason: `Không tìm thấy deployment nào cho environment "${envName}"`,
        envName,
        projectPath,
      });
    }

    const latest = deployments[0];
    const deployedBranch = latest.ref || latest.sha?.slice(0, 8) || "unknown";
    const match = deployedBranch === expectedBranch;

    return NextResponse.json({
      found: true,
      match,
      deployedBranch,
      expectedBranch,
      envName,
      projectPath,
      deployedAt: latest.created_at,
      deployStatus: latest.status,
    });
  } catch (error) {
    return NextResponse.json(
      { found: false, reason: String(error) },
      { status: 500 }
    );
  }
}
