/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * A deterministic, no-API-key mock agent useful for tests. It echoes the
 * prompt back as token events and emits an `end` event. The "binary" is
 * a tiny shell script written by ensureProvider on first use.
 */

import type { AgentDefinition, BuildCommandContext, ParseResult, ParseState } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { shellSingleQuote } from "../../sandbox/shell.js"
import { splitLines, safeJsonParse } from "../../utils/index.js"

function buildCommand(ctx: BuildCommandContext): string {
  // The "mock binary" is just a here-doc that emits structured JSONL.
  // We embed everything inline so no external file is required.
  const prompt = shellSingleQuote(ctx.prompt)
  const reply = `Echoing your prompt: ${ctx.prompt}`
  const cdPart = ctx.cwd ? `cd ${shellSingleQuote(ctx.cwd)} && ` : ""
  // Each printf line is a JSON event. Newlines between them are explicit.
  const lines = [
    `{"type":"token","text":${JSON.stringify(reply)}}`,
    `{"type":"end"}`,
  ]
  const echos = lines.map(l => `printf '%s\\n' ${shellSingleQuote(l)}`).join("; ")
  // We swallow the prompt arg so we still type-check; expose for debugging.
  return `${cdPart}${echos}; : ${prompt}`
}

function parseEvents(rawSlice: string, state: ParseState): ParseResult {
  const combined = state.buffer + rawSlice
  const { lines, remainder } = splitLines(combined)
  const events: Event[] = []
  for (const raw of lines) {
    const obj = safeJsonParse<Event>(raw)
    if (obj && typeof obj.type === "string") events.push(obj)
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

export const mockAgent: AgentDefinition = {
  name: "mock",
  binaryName: "charclaw-mock",
  buildCommand,
  parseEvents,
}
