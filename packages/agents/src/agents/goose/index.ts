/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Block Goose CLI agent. Public docs:
 *   https://block.github.io/goose/docs/
 *
 * Goose is installed via a shell installer (not npm) and reads its
 * provider/model from ~/.config/goose/config.yaml. The Daytona adapter
 * seeds a default config during ensureProvider.
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface GooseLine {
  type?: string
  text?: string
  content?: string
  delta?: string
  tool?: string
  name?: string
  arguments?: unknown
  output?: string
  result?: string
  is_error?: boolean
}

function buildCommand(ctx: BuildCommandContext): string {
  // Goose's run command takes the prompt as --text. Output mode varies by version.
  const flags = ["run", "--output-format", "json", "--text", shellSingleQuote(ctx.prompt)]
  const env: string[] = []
  if (ctx.model) env.push(`GOOSE_MODEL=${shellSingleQuote(ctx.model)}`)
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  const envPart = env.length ? `${env.join(" ")} ` : ""
  return `${cdPart}${envPart}goose ${flags.join(" ")}`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []

  for (const raw of lines) {
    const obj = safeJsonParse<GooseLine>(raw)
    if (!obj) {
      // Fallback: emit raw line as token if it's plain text.
      if (raw.trim()) events.push({ type: "token", text: raw + "\n" })
      continue
    }
    const t = obj.type ?? ""
    if (t === "text" || t === "message" || t === "delta") {
      const text = obj.text ?? obj.content ?? obj.delta ?? ""
      if (text) events.push({ type: "token", text })
    } else if (t === "tool" || t === "tool_call") {
      events.push({
        type: "tool_start",
        name: normalizeToolName(obj.tool ?? obj.name ?? "tool"),
        input: obj.arguments,
      })
    } else if (t === "tool_result") {
      events.push({
        type: "tool_end",
        ...(obj.output !== undefined ? { output: obj.output } : {}),
        ...(obj.is_error ? { isError: true } : {}),
      })
    } else if (t === "end" || t === "done" || t === "completion") {
      events.push({ type: "end" })
    }
  }

  return {
    events,
    state: {
      position: state.position + rawSlice.length,
      buffer: remainder,
      scratch: state.scratch,
    },
  }
}

export const gooseAgent: AgentDefinition = {
  name: "goose",
  binaryName: "goose",
  shellInstaller:
    'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh ' +
    '| CONFIGURE=false bash',
  defaultModel: "gpt-4o",
  buildCommand,
  parseEvents,
}
