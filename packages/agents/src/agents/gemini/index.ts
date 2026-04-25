/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Google Gemini CLI agent. Public docs:
 *   https://geminicli.com/docs/
 *
 * NOTE: The Gemini CLI's stream-json schema is still stabilizing across
 * releases. This parser accepts a tolerant superset (delta / message /
 * tool_call / tool_result / done). Validate end-to-end with your version.
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface GeminiLine {
  type?: string
  text?: string
  delta?: string
  content?: string
  tool?: string
  name?: string
  args?: unknown
  arguments?: unknown
  output?: string
  result?: string
  session_id?: string
  error?: string
}

function buildCommand(ctx: BuildCommandContext): string {
  const flags = ["--output-format", "stream-json", "--yolo"]
  if (ctx.model) flags.push("--model", shellSingleQuote(ctx.model))
  if (ctx.systemPrompt) flags.push("--system-prompt", shellSingleQuote(ctx.systemPrompt))
  flags.push("-p", shellSingleQuote(ctx.prompt))
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  return `${cdPart}gemini ${flags.join(" ")}`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []

  for (const raw of lines) {
    const obj = safeJsonParse<GeminiLine>(raw)
    if (!obj) continue
    const type = obj.type ?? ""
    if (type === "session" || type === "session_start") {
      if (obj.session_id) events.push({ type: "session", id: obj.session_id })
    } else if (type.endsWith("delta") || type === "text") {
      const t = obj.delta ?? obj.text ?? obj.content ?? ""
      if (t) events.push({ type: "token", text: t })
    } else if (type === "message" || type === "assistant_message") {
      const t = obj.text ?? obj.content ?? ""
      if (t) events.push({ type: "token", text: t })
    } else if (type === "tool_call" || type === "tool_use" || type === "function_call") {
      events.push({
        type: "tool_start",
        name: normalizeToolName(obj.tool ?? obj.name ?? "tool"),
        input: obj.args ?? obj.arguments,
      })
    } else if (type === "tool_result" || type === "function_result") {
      events.push({
        type: "tool_end",
        ...(obj.output !== undefined ? { output: obj.output } : {}),
      })
    } else if (type === "done" || type === "completion" || type === "result" || type === "end") {
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

export const geminiAgent: AgentDefinition = {
  name: "gemini",
  binaryName: "gemini",
  packageName: "@google/gemini-cli",
  defaultModel: "gemini-2.0-flash",
  buildCommand,
  parseEvents,
}
