/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Claude Code agent definition. CLI flags and JSON event shape per
 * Anthropic's public Claude Code documentation:
 *   https://docs.anthropic.com/en/docs/claude-code
 *
 * Stream-json events emitted by `claude -p --output-format stream-json`:
 *   - {"type": "system", "subtype": "init", "session_id": "..."}
 *   - {"type": "assistant", "message": {"content": [...]}}
 *       content blocks include {type: "text", text} and {type: "tool_use", id, name, input}
 *   - {"type": "user", "message": {"content": [{type: "tool_result", tool_use_id, content}]}}
 *   - {"type": "result", "subtype": "success" | "error_..."}
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event, ToolName } from "../../types/events.js"
import { normalizeToolName } from "../../core/tools.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

interface ClaudeAssistantContent {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

interface ClaudeStreamLine {
  type?: string
  subtype?: string
  session_id?: string
  is_error?: boolean
  result?: string
  message?: {
    role?: string
    content?: ClaudeAssistantContent[] | string
  }
}

interface ClaudeScratch {
  /** Maps tool_use id → original tool name so tool_end can carry the right name. */
  toolNames: Record<string, ToolName>
  sessionEmitted: boolean
}

function getScratch(state: ParseState): ClaudeScratch {
  const existing = state.scratch as { claude?: ClaudeScratch }
  if (!existing.claude) {
    existing.claude = { toolNames: {}, sessionEmitted: false }
  }
  return existing.claude
}

function buildCommand(ctx: BuildCommandContext): string {
  const flags: string[] = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
  ]
  if (ctx.model) {
    flags.push("--model", shellSingleQuote(ctx.model))
  }
  if (ctx.systemPrompt) {
    flags.push("--system-prompt", shellSingleQuote(ctx.systemPrompt))
  }
  const prompt = shellSingleQuote(ctx.prompt)
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  return `${cdPart}claude ${flags.join(" ")} -- ${prompt}`
}

function eventsForAssistantBlock(block: ClaudeAssistantContent, scratch: ClaudeScratch): Event[] {
  if (block.type === "text" && typeof block.text === "string") {
    return [{ type: "token", text: block.text }]
  }
  if (block.type === "tool_use" && block.name) {
    const id = block.id ?? ""
    const canonical = normalizeToolName(block.name)
    if (id) scratch.toolNames[id] = canonical
    return [
      {
        type: "tool_start",
        name: canonical,
        ...(id ? { id } : {}),
        ...(block.input !== undefined ? { input: block.input } : {}),
      },
    ]
  }
  return []
}

function eventsForUserBlock(block: ClaudeAssistantContent, scratch: ClaudeScratch): Event[] {
  if (block.type !== "tool_result") return []
  const id = block.tool_use_id ?? ""
  const name = id ? scratch.toolNames[id] : undefined
  let output: string | undefined
  if (typeof block.content === "string") {
    output = block.content
  } else if (Array.isArray(block.content)) {
    output = block.content
      .filter(c => c.type === "text" && typeof c.text === "string")
      .map(c => c.text as string)
      .join("\n")
  }
  return [
    {
      type: "tool_end",
      ...(name ? { name } : {}),
      ...(id ? { id } : {}),
      ...(output !== undefined ? { output } : {}),
      ...(block.is_error ? { isError: true } : {}),
    },
  ]
}

function eventsForLine(line: ClaudeStreamLine, scratch: ClaudeScratch): Event[] {
  const out: Event[] = []
  if (line.type === "system" && line.subtype === "init" && !scratch.sessionEmitted) {
    if (line.session_id) {
      out.push({ type: "session", id: line.session_id })
      scratch.sessionEmitted = true
    }
  } else if (line.type === "assistant" && line.message && Array.isArray(line.message.content)) {
    for (const block of line.message.content) {
      out.push(...eventsForAssistantBlock(block, scratch))
    }
  } else if (line.type === "user" && line.message && Array.isArray(line.message.content)) {
    for (const block of line.message.content) {
      out.push(...eventsForUserBlock(block, scratch))
    }
  } else if (line.type === "result") {
    out.push({
      type: "end",
      ...(line.is_error || (line.subtype && line.subtype !== "success")
        ? { error: line.subtype ?? "error" }
        : {}),
    })
  }
  return out
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const scratch = getScratch(state)
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []
  for (const raw of lines) {
    const parsed = safeJsonParse<ClaudeStreamLine>(raw)
    if (!parsed) continue
    events.push(...eventsForLine(parsed, scratch))
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

export const claudeAgent: AgentDefinition = {
  name: "claude",
  binaryName: "claude",
  packageName: "@anthropic-ai/claude-code",
  defaultModel: "sonnet",
  buildCommand,
  parseEvents,
}
