/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Pi CLI agent. Public docs:
 *   https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface PiLine {
  type?: string
  text?: string
  delta?: string
  tool?: string
  name?: string
  args?: unknown
  output?: string
  is_error?: boolean
}

function buildCommand(ctx: BuildCommandContext): string {
  const flags = ["--mode", "json"]
  if (ctx.model) flags.push("--model", shellSingleQuote(ctx.model))
  flags.push("-p", shellSingleQuote(ctx.prompt))
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  return `${cdPart}pi ${flags.join(" ")}`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []

  for (const raw of lines) {
    const obj = safeJsonParse<PiLine>(raw)
    if (!obj) continue
    const t = obj.type ?? ""
    if (t === "delta" || t === "text") {
      const text = obj.text ?? obj.delta ?? ""
      if (text) events.push({ type: "token", text })
    } else if (t === "tool_call" || t === "tool_use") {
      events.push({
        type: "tool_start",
        name: normalizeToolName(obj.tool ?? obj.name ?? "tool"),
        input: obj.args,
      })
    } else if (t === "tool_result") {
      events.push({
        type: "tool_end",
        ...(obj.output !== undefined ? { output: obj.output } : {}),
        ...(obj.is_error ? { isError: true } : {}),
      })
    } else if (t === "done" || t === "end") {
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

export const piAgent: AgentDefinition = {
  name: "pi",
  binaryName: "pi",
  packageName: "@badlogic/pi-coding-agent",
  defaultModel: "sonnet",
  buildCommand,
  parseEvents,
}
