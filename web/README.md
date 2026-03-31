# Shopify Autotest Web UI

Web interface for the Shopify Playwright automation test runner.

## Setup

```bash
cd web
npm install
npm run dev
```

Or from the project root:

```bash
npm run web
```

The app runs at [http://localhost:3100](http://localhost:3100).

## Pages

- **Dashboard** (`/`) - Overview with test suite cards and recent runs
- **Run Tests** (`/run`) - Configure and execute test suites with real-time log streaming
- **History** (`/history`) - View past test run results
- **Settings** (`/settings`) - Configure store handle, Notion token, and timeout

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- SSE for real-time log streaming
