# SETUP.md — Hướng dẫn cài đặt cho Tester

Tài liệu này dành cho **tester** cài đặt lần đầu trên máy cá nhân.

---

## Yêu cầu

| Công cụ | Version | Kiểm tra |
|---------|---------|---------|
| Node.js | ≥ 18 | `node --version` |
| Git | any | `git --version` |
| OpenClaw | latest | `openclaw --version` |

---

## Bước 1 — Clone dự án

```bash
git clone https://github.com/2imPusc/Automation-Test.git shopify-autotest
cd shopify-autotest
npm install
npx playwright install chromium
```

---

## Bước 2 — Clone source code các app

Source code app cần có trên máy để AI đọc context (data-testid, routes, locale...).
Thư mục clone **phải đặt đúng đường dẫn** trong `apps-registry.json`.

```bash
# Avada Plaza (Image Optimizer)
git clone https://gitlab.com/avada/avada-image-optimizer ~/avada-image-optimizer

# SEO Suite
git clone https://gitlab.com/avada/seo ~/seo

# Blogs
git clone https://gitlab.com/avada/blogs ~/blogs
```

> **Lưu ý:** Nếu đường dẫn khác thì cập nhật `skills/shopify-test-gen/references/apps-registry.json`
> — sửa `repoPath` cho từng app tương ứng.

---

## Bước 3 — Cấu hình file `.env`

Copy template và điền thông tin:

```bash
cp .env.example .env
```

Mở `.env` và điền:

```env
# ── Store ─────────────────────────────────────────────
STORE_HANDLE=ten-store-shopify-cua-ban

# ── App Handles (Production) ──────────────────────────
AVADA_PLAZA_HANDLE=avada-image-optimizer
SEO_HANDLE=avada-seo-suite
BLOGS_HANDLE=avada-blogs

# ── App Handles (Staging) ─────────────────────────────
STAGING_1_AVADA_PLAZA_HANDLE=avada-image-optimizer-staging-1
STAGING_2_AVADA_PLAZA_HANDLE=avada-image-optimizer-staging-2
STAGING_3_AVADA_PLAZA_HANDLE=avada-image-optimizer-staging-3
# ... (lấy handle từ Shopify Admin → Apps → URL)

STAGING_1_SEO_HANDLE=...
STAGING_2_SEO_HANDLE=...
# ...

# ── Notion Integration ────────────────────────────────
# Lấy từ: Notion → Settings → Connections → Develop integrations → Avada integration
AVADA_NOTION_TOKEN=ntn_...

# ── GitLab Integration ────────────────────────────────
# Lấy từ: GitLab → Avatar → Edit profile → Access Tokens → tạo với scope read_api
GITLAB_TOKEN=glpat-...
GITLAB_URL=https://gitlab.com
```

---

## Bước 4 — Cài đặt OpenClaw

OpenClaw cho phép tester dùng Claude Max (subscription cá nhân) để gen test — không cần API key riêng.

```bash
npm install -g openclaw
openclaw auth        # đăng nhập tài khoản Anthropic
openclaw start       # khởi động OpenClaw daemon
```

Kiểm tra đang chạy:
```bash
openclaw status
```

> OpenClaw cần chạy **trước khi dùng Web UI** để gen test case hoạt động.

---

## Bước 5 — Cài đặt Web UI

```bash
cd web
npm install

# Tạo file .env.local cho Web UI (tự đồng bộ từ root .env)
cp ../.env.example .env.example   # chỉ để tham khảo
cat > .env.local << 'EOF'
AVADA_NOTION_TOKEN=<dán token Notion vào đây>
GITLAB_TOKEN=<dán GitLab token vào đây>
GITLAB_URL=https://gitlab.com
EOF

npm run dev
```

Web UI chạy tại: **http://localhost:3100**

> **Lưu ý:** `web/.env.local` không commit lên git. Mỗi tester tự điền token của mình.

---

## Bước 6 — Đăng nhập Shopify

```bash
# Quay về thư mục gốc
cd ..
npm run auth
```

Browser mở → đăng nhập Shopify bình thường. Session lưu tự động.

---

## Bước 7 — Chạy thử

```bash
npm run test:smoke
```

✅ Pass → cài đặt hoàn tất.

---

## Workflow hàng ngày

### Cách 1 — Web UI (khuyến nghị)

1. Đảm bảo OpenClaw đang chạy: `openclaw status`
2. Đảm bảo Web UI đang chạy: `cd web && npm run dev`
3. Mở **http://localhost:3100/smart-run**
4. Paste Notion task link → Parse → Gen test → Verify staging → Run

### Cách 2 — Terminal

```bash
# Gen test mới từ Notion task
npm run test:generate

# Verify staging + run test
npm run test:run

# Chỉ run test thủ công
npm run test:smoke
npm run test:pick
```

---

## Cấu trúc agent (OpenClaw)

Khi dùng Web UI để gen test, hệ thống dùng 2 agent trong OpenClaw:

```
Web UI (localhost:3100)
  └→ OpenClaw Gateway (localhost:18789)
        ├─ Agent main   → Booni (hội thoại, điều phối)
        └─ Agent test-gen → Shopify Test Generator
                ├─ Workspace: /path/to/shopify-autotest
                ├─ Đọc skills/shopify-test-gen/SKILL.md (rules)
                ├─ Đọc .context/[app].md (source code đã extract)
                ├─ Đọc snapshots/ (DOM thật)
                └─ Sinh test case + Page Object files
```

**Agent `test-gen`** cần được thêm vào OpenClaw config:

```json
{
  "id": "test-gen",
  "name": "Shopify Test Generator",
  "workspace": "/path/to/shopify-autotest",
  "agentDir": "~/.openclaw/agents/test-gen/agent",
  "model": "anthropic/claude-sonnet-4-6"
}
```

Tạo AGENTS.md cho agent tại `~/.openclaw/agents/test-gen/agent/AGENTS.md` — copy từ file mẫu trong repo:
```bash
mkdir -p ~/.openclaw/agents/test-gen/agent
cp docs/test-gen-AGENTS.md ~/.openclaw/agents/test-gen/agent/AGENTS.md
# Sửa workspace path trong file cho đúng máy của bạn
```

**Lý do cần OpenClaw:** Claude Max subscription không có API key trực tiếp.
OpenClaw hoạt động như proxy local — web gọi OpenClaw, OpenClaw gọi Claude với session của bạn.

---

## Troubleshooting

### `AVADA_NOTION_TOKEN is not configured`
→ Tạo `web/.env.local` và điền token (xem Bước 5)

### `GITLAB_TOKEN not configured`
→ Tạo GitLab Personal Access Token với scope `read_api` (xem Bước 3)

### OpenClaw chưa chạy
```bash
openclaw start
openclaw status    # phải thấy "running"
```

### Session Shopify hết hạn
```bash
npm run auth:reset
npm run auth
```

### Không tìm thấy app handle
→ Vào Shopify Admin → Apps → click app → xem URL → copy `[handle]`

### Source code app không đồng bộ với branch cần test
```bash
cd ~/avada-image-optimizer   # hoặc ~/seo, ~/blogs
git fetch --all
git checkout ten-branch
git pull
```
Sau đó chạy lại gen test — context-sync sẽ tự re-extract.

---

## Thông tin cần hỏi team để điền .env

| Thông tin | Hỏi ai |
|-----------|--------|
| Staging handles (1, 2, 3...) | Dev/DevOps |
| Avada Notion integration token | Team lead |
| GitLab URL (nếu self-hosted) | DevOps |
| Store handle cho test | Dev |

---

*Có vấn đề không có trong guide này? Ping team dev hoặc tạo issue trên GitLab.*
