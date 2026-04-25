/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * OpenCode CLI agent. Public docs: https://opencode.ai/docs/
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface OpenCodeLine {
  type?: string
  text?: string
  delta?: string
  content?: string
  tool?: string
  name?: string
  arguments?: unknown
  input?: unknown
  output?: string
  result?: string
  is_error?: boolean
  error?: string
}

function buildCommand(ctx: BuildCommandContext): string {
  const flags = ["run", "--format", "json"]
  if (ctx.model) flags.push("--model", shellSingleQuote(ctx.model))
  flags.push("--", shellSingleQuote(ctx.prompt))
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  // 2>&1 because some OpenCode versions emit JSON to stderr.
  return `${cdPart}opencode ${flags.join(" ")} 2>&1`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []

  for (const raw of lines) {
    const obj = safeJsonParse<OpenCodeLine>(raw)
    if (!obj) continue
    const t = obj.type ?? ""
    if (t === "text" || t === "delta" || t === "message") {
      const text = obj.text ?? obj.delta ?? obj.content ?? ""
      if (text) events.push({ type: "token", text })
    } else if (t === "tool_call" || t === "tool_use") {
      events.push({
        type: "tool_start",
        name: normalizeToolName(obj.tool ?? obj.name ?? "tool"),
        input: obj.arguments ?? obj.input,
      })
    } else if (t === "tool_result") {
      events.push({
        type: "tool_end",
        ...(obj.output !== undefined ? { output: obj.output } : {}),
        ...(obj.is_error ? { isError: true } : {}),
      })
    } else if (t === "end" || t === "done" || t === "result") {
      events.push({
        type: "end",
        ...(obj.error ? { error: obj.error } : {}),
      })
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

export const opencodeAgent: AgentDefinition = {
  name: "opencode",
  binaryName: "opencode",
  packageName: "opencode-ai",
  defaultModel: "openai/gpt-4o",
  buildCommand,
  parseEvents,
}
