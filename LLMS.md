# LLMS.md

A curated entry-point for AI agents reading this repo. The website-spec version of this file lives at [`public-site/llms.txt`](./public-site/llms.txt) and is served at <https://anitchaudhry.github.io/CharClaw-App/llms.txt>.

## What this repo is

**CharClaw** is a self-hosted AI engineering platform. Users assign GitHub issues to AI coding agents (Claude Code, OpenAI Codex, Google Gemini, Block Goose, OpenCode, Pi), and the agents code, commit, and push pull requests on the user's own machine. The agent execution layer is published as a standalone npm package — [`@charclaw/agents`](https://www.npmjs.com/package/@charclaw/agents) — under AGPL-3.0-or-later.

## What's in this repo

| Path | Purpose |
|---|---|
| `packages/agents/` | The `@charclaw/agents` SDK source (TypeScript, AGPL-3.0). Published on npm. |
| `packages/web/` | The Next.js 16 web dashboard (`@charclaw/web`, Apache 2.0). |
| `packages/daemon/` | Node CLI daemon that runs on the user's machine, picks up tasks via SSE, and executes agents (`@charclaw/daemon`, Apache 2.0). |
| `packages/desktop/` | Electron wrapper around the web app + bundled daemon (`@charclaw/desktop`, Apache 2.0). |
| `packages/landing/` | Vite + React marketing landing page (`@charclaw/landing`, Apache 2.0). |
| `packages/simple-chat/` | A minimal chat reference app demonstrating the SDK. |
| `packages/common/` | Shared types and helpers across web/daemon/simple-chat. |
| `packages/terminal/` | xterm.js-based terminal panel. |
| `public-site/` | The static HTML/CSS/JS landing site served at <https://anitchaudhry.github.io/CharClaw-App/>. Includes blog posts and SDK docs. |

## Where to find the public docs

- **SDK reference:** <https://anitchaudhry.github.io/CharClaw-App/docs/agents-sdk.html>
- **Launch post:** <https://anitchaudhry.github.io/CharClaw-App/blog/launching-charclaw-agents-sdk.html>
- **npm package:** <https://www.npmjs.com/package/@charclaw/agents>
- **Architecture (full):** [`README.md`](./README.md) §Architecture
- **Deployment guide:** [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- **Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Code of Conduct:** [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- **Security policy:** [`SECURITY.md`](./SECURITY.md)
- **Coding-agent setup notes** (for Claude Code, Cursor, etc. working in this repo): [`AGENTS.md`](./AGENTS.md)

## How an AI agent should orient itself

1. **For "how do I install the SDK?"** → npm: `npm install @charclaw/agents @daytonaio/sdk`. Quick-start examples live in [`packages/agents/README.md`](./packages/agents/README.md).
2. **For "how does CharClaw work end-to-end?"** → [`README.md`](./README.md) §Architecture has Mermaid diagrams of the system, the data model, and the desktop process model.
3. **For "how do I deploy CharClaw to production?"** → [`DEPLOYMENT.md`](./DEPLOYMENT.md) has a 12-section checklist (OAuth app, secrets, database, autopilot cron, signed builds, licensing notes).
4. **For "how do I add a new agent to the SDK?"** → Look at `packages/agents/src/agents/claude/index.ts` and follow the pattern. Write a `buildCommand()` that returns the CLI invocation, and a `parseEvents()` that turns the agent's JSON output into the SDK's `Event` union (defined in `packages/agents/src/types/events.ts`).
5. **For "how do I run the dev stack?"** → `bash scripts/setup.sh` then `npm run dev`. See [`DEVELOPMENT.md`](./DEVELOPMENT.md).
6. **For "where are the tests?"** → [`TESTING.md`](./TESTING.md) covers unit (vitest), integration, and Playwright E2E.

## Maintainer

**Anit Chaudhary** — `anitc98@gmail.com`. Commercial-licensing inquiries for the AGPL-3.0 SDK welcome at the same address.

## Licensing summary

- App (web, daemon, desktop, landing, simple-chat, common, terminal): **Apache 2.0** — fork freely, change the brand, ship commercially.
- Agent SDK (`@charclaw/agents`): **AGPL-3.0-or-later** — fork freely; modifications run as a network service must be open-sourced too.
- Full text in [`LICENSE`](./LICENSE).
