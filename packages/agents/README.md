# `@charclaw/agents`

[![npm version](https://img.shields.io/npm/v/@charclaw/agents.svg)](https://www.npmjs.com/package/@charclaw/agents)
[![npm downloads](https://img.shields.io/npm/dm/@charclaw/agents.svg)](https://www.npmjs.com/package/@charclaw/agents)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](./LICENSE)
[![Node ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](#)

The agents SDK that powers [CharClaw](https://github.com/AnitChaudhry/CharClaw-App). A TypeScript library for running AI coding agents — Claude, Codex, Gemini, Goose, OpenCode, Pi — inside [Daytona](https://daytona.io) cloud sandboxes or directly on the host machine.

> Copyright © 2026 Anit Chaudhary · Licensed under [AGPL-3.0-or-later](./LICENSE).
>
> **Live on npm:** [`@charclaw/agents@0.2.0`](https://www.npmjs.com/package/@charclaw/agents)

## Why

Coding agent CLIs (Claude Code, Codex, Gemini, …) are designed to run interactively. To wire them into a long-running web service or scheduled job, you need:

- **Background execution** that survives your serverless function timeout
- **Polling-based event streaming** instead of stdin/stdout pipes
- **Sandbox isolation** so agent activity can't reach your production secrets
- **Re-attachment** to ongoing turns after a process restart

`@charclaw/agents` gives you one TypeScript API across all of these agents and runs them in whichever sandbox you already use.

## Install

```bash
npm install @charclaw/agents @daytonaio/sdk
```

## Quick start (Daytona sandbox)

```ts
import { Daytona } from "@daytonaio/sdk"
import { adaptDaytonaSandbox, createSession } from "@charclaw/agents"

const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY! })
const raw = await daytona.create()
const sandbox = adaptDaytonaSandbox(raw)

const session = await createSession("claude", {
  sandbox,
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
  model: "sonnet",
  systemPrompt: "You are a careful, focused engineer.",
})

await session.start("Add input validation to the /signup route.")

while (true) {
  const { events, running } = await session.getEvents()
  for (const e of events) {
    if (e.type === "token") process.stdout.write(e.text)
    if (e.type === "tool_start") console.log(`\n[tool] ${e.name}`)
  }
  if (!running) break
  await new Promise(r => setTimeout(r, 1000))
}

await raw.delete()
```

## Quick start (local sandbox)

```ts
import { createLocalSandbox, createSession, localWorkdir } from "@charclaw/agents"

const sandbox = createLocalSandbox({ cwd: localWorkdir() })
const session = await createSession("claude", {
  sandbox,
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
})
await session.start("Summarize the diff on this branch.")
```

## Restart-tolerant turns

Persist `session.id` and reattach later:

```ts
import { adaptDaytonaSandbox, getSession } from "@charclaw/agents"

const sandbox = adaptDaytonaSandbox(await daytona.get(savedSandboxId))
const session = await getSession(savedSessionId, { sandbox })
const { events, running } = await session.getEvents()
```

The session writes its metadata and parser state to `~/.charclaw-sessions/<id>/` inside the sandbox, so a second process can pick up exactly where the first left off.

## Supported agents

| Agent | CLI | Auth | Status |
|---|---|---|---|
| `"claude"` | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_CREDENTIALS` | ✅ Stable parser |
| `"codex"` | [OpenAI Codex CLI](https://developers.openai.com/codex/cli) | `OPENAI_API_KEY` | ⚠️ Tolerant parser, validate against your CLI version |
| `"gemini"` | [Google Gemini CLI](https://geminicli.com/docs/) | `GEMINI_API_KEY` | ⚠️ Tolerant parser |
| `"goose"` | [Block Goose](https://block.github.io/goose/docs/) | provider-specific | ⚠️ Tolerant parser |
| `"opencode"` | [OpenCode](https://opencode.ai/docs/) | provider-specific | ⚠️ Tolerant parser |
| `"pi"` | [Pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) | provider-specific | ⚠️ Tolerant parser |
| `"mock"` | (built-in) | none | ✅ Echo-only, useful for tests |

The parsers for Codex, Gemini, Goose, OpenCode, and Pi accept a tolerant superset of common JSON event shapes. End-to-end test against the version of the CLI you actually deploy and tighten if needed.

## Event types

```ts
type Event =
  | { type: "session"; id: string }
  | { type: "token"; text: string }
  | { type: "tool_start"; name: string; id?: string; input?: unknown }
  | { type: "tool_delta"; id?: string; text: string }
  | { type: "tool_end"; name?: string; id?: string; output?: string; isError?: boolean }
  | { type: "end"; error?: string }
  | { type: "agent_crashed"; message?: string; output?: string }
```

## How it works

1. `createSession` provisions a session directory inside the sandbox and writes `session.json` (your config) and `state.json` (parser cursor).
2. `session.start(prompt)` issues `nohup` (Daytona) or `spawn(detached: true)` (local) to launch the agent CLI, writing stdout to a turn-specific log file.
3. `session.getEvents()` reads the log file's new bytes, runs the agent's JSON-Lines parser, and returns events plus a `running` flag.
4. A `.done` sentinel file plus a process-liveness probe distinguish a clean finish from a crash.
5. State is persisted between calls so a second process can `getSession()` and continue.

## Debugging

```bash
CHARCLAW_AGENTS_DEBUG=1 node my-script.js
```

## License

GNU AGPL v3 or later. See [LICENSE](./LICENSE) for the full text.

This is **strong copyleft** — if you run a modified version of `@charclaw/agents` as a network service, you must offer the source code of your modifications to the users of that service. If that doesn't fit your use case, contact the author for commercial licensing.
