# Agentic UI Builder

Chat-driven UI builder for non-technical / backend developers. Describe what you
want in plain English; an AI agent writes real React + Tailwind code into this
repo, you see it render live, and you raise a PR with one click.

## How it works

```
┌────────────┐   chat    ┌──────────────┐   Agent SDK    ┌────────────────┐
│  Builder   │──────────▶│  Express API │───────────────▶│ src/generated/ │
│ (Vite/React)│           │ /api/chat    │  Read/Write/   │   App.tsx      │
│  chat + iframe          │ /api/pr      │  Edit tools    └────────┬───────┘
└─────▲──────┘           └──────┬───────┘                         │ HMR
      │  iframe /preview.html   │ gh pr create                    ▼
      └─────────────────────────┴──────────────────────── live preview
```

- **Agent engine:** `@anthropic-ai/claude-agent-sdk` (`server/agent.mjs`). It is
  scoped to `src/generated/` and given only file tools (Read/Write/Edit/Glob/Grep).
- **Preview:** `preview.html` renders `src/generated/App.tsx`. Vite HMR refreshes
  the iframe the moment the agent edits a file.
- **PR:** `server/git.mjs` branches, commits the working-tree changes, pushes, and
  opens a PR via the `gh` CLI.

## Prerequisites

- Node 18+ and npm
- `gh` CLI authenticated (`gh auth status`) — used to raise PRs
- **Auth for the agent**, either:
  - `export ANTHROPIC_API_KEY=sk-ant-...`, **or**
  - a logged-in Claude Code session (the SDK reuses it)

## Run

```bash
npm install
npm run dev          # starts Vite (5173) + API (8787)
```

Open http://localhost:5173

1. Type a request, e.g. *"Build a pricing page with three tiers."*
2. Watch it render in the live preview.
3. Keep iterating in chat.
4. Click **Raise PR** when done.

## Config

| Env var             | Default            | Purpose                          |
| ------------------- | ------------------ | -------------------------------- |
| `ANTHROPIC_API_KEY` | (Claude Code auth) | Agent authentication             |
| `AGENT_MODEL`       | `claude-sonnet-5`  | Model used by the agent          |
| `PORT`              | `8787`             | API port                         |
