/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type { Event } from "../types/events.js"
import type { ProviderName } from "../types/provider.js"

export interface BuildCommandContext {
  cwd: string
  model?: string
  systemPrompt?: string
  prompt: string
}

export interface ParseState {
  /** Number of output bytes already consumed by the parser. */
  position: number
  /** Partial line accumulated when output ends mid-line. */
  buffer: string
  /** Per-agent free-form scratch (e.g. tool-id-to-name maps). */
  scratch: Record<string, unknown>
}

export interface ParseResult {
  events: Event[]
  state: ParseState
}

export interface AgentDefinition {
  name: ProviderName
  binaryName?: string
  packageName?: string
  shellInstaller?: string
  defaultModel?: string

  buildCommand(ctx: BuildCommandContext): string
  parseEvents(rawOutput: string, state: ParseState): ParseResult
}

export function emptyParseState(): ParseState {
  return { position: 0, buffer: "", scratch: {} }
}
