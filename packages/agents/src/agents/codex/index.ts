/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * OpenAI Codex CLI agent definition. Built against the public Codex CLI:
 *   https://developers.openai.com/codex/cli
 *
 * NOTE: The Codex CLI event schema has evolved across releases. This
 * parser handles the common shapes (agent_message_delta, tool_use,
 * tool_result, completion). Validate against your installed version and
 * extend as needed.
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface CodexLine {
  type?: string
  delta?: string
  text?: string
  message?: string | { content?: string }
  tool_name?: string
  name?: string
  arguments?: unknown
  input?: unknown
  output?: string
  result?: string
  session_id?: string
  is_error?: boolean
  error?: string
}

function buildCommand(ctx: BuildCommandContext): string {
  const flags = ["exec", "--json", "--skip-git-repo-check", "--yolo"]
  if (ctx.model) flags.push("--model", shellSingleQuote(ctx.model))
  if (ctx.systemPrompt) {
    // Codex injects a custom instructions file. Easiest portable form: prepend.
    const merged = `${ctx.systemPrompt}\n\n---\n\n${ctx.prompt}`
    const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
    return `${cdPart}codex ${flags.join(" ")} -- ${shellSingleQuote(merged)}`
  }
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  return `${cdPart}codex ${flags.join(" ")} -- ${shellSingleQuote(ctx.prompt)}`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []

  for (const raw of lines) {
    const obj = safeJsonParse<CodexLine>(raw)
    if (!obj || !obj.type) continue
    switch (obj.type) {
      case "session_started":
      case "session_start":
      case "session":
        if (obj.session_id) events.push({ type: "session", id: obj.session_id })
        break

      case "agent_message_delta":
      case "message_delta":
      case "delta": {
        const t = obj.delta ?? obj.text ?? ""
        if (t) events.push({ type: "token", text: t })
        break
      }

      case "agent_message":
      case "assistant_message":
      case "message": {
        const t =
          obj.text ?? (typeof obj.message === "string" ? obj.message : obj.message?.content) ?? ""
        if (t) events.push({ type: "token", text: t })
        break
      }

      case "tool_use":
      case "function_call": {
        const name = obj.tool_name ?? obj.name ?? "tool"
        events.push({
          type: "tool_start",
          name: normalizeToolName(name),
          input: obj.arguments ?? obj.input,
        })
        break
      }

      case "tool_result":
      case "function_result": {
        events.push({
          type: "tool_end",
          ...(obj.output !== undefined ? { output: obj.output } : {}),
          ...(obj.is_error ? { isError: true } : {}),
        })
        break
      }

      case "task_complete":
      case "completion":
      case "result":
      case "done":
        events.push({
          type: "end",
          ...(obj.is_error || obj.error ? { error: obj.error ?? "error" } : {}),
        })
        break
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

export const codexAgent: AgentDefinition = {
  name: "codex",
  binaryName: "codex",
  packageName: "@openai/codex",
  defaultModel: "gpt-4o",
  buildCommand,
  parseEvents,
}
