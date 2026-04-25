/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type { Event } from "../types/events.js"
import type { CodeAgentSandbox, ProviderName } from "../types/provider.js"

export type BackgroundRunPhase =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "crashed"
  | "cancelled"
  | "stopped"

export interface TurnHandle {
  pid: number
  outputFile: string
  startedAt: number
  turnId: string
}

export interface PollResult {
  events: Event[]
  running: boolean
  /** Session ID (mirrors BackgroundSession.id) — present when a turn has been started. */
  sessionId: string | null
  /** Opaque cursor; advances each poll. Consumers can persist for restart-tolerance. */
  cursor: string
  /** Detailed phase. Mirrors `running` for callers that want a richer signal. */
  runPhase: BackgroundRunPhase
}

export interface StartOptions {
  /** Run-scoped env vars (cleared after the turn completes). */
  env?: Record<string, string>
  /** Optional history hint for agents that accept it. */
  history?: readonly HistoryMessage[]
}

export interface HistoryMessage {
  role: "user" | "assistant"
  content: string
  timestamp?: number
}

export interface SessionMeta {
  id: string
  provider: ProviderName
  model?: string
  systemPrompt?: string
  cwd?: string
  createdAt: number
}

export interface SessionState {
  currentTurn?: TurnHandle
  parserPosition: number
  parserBuffer: string
  parserScratch: Record<string, unknown>
  phase: BackgroundRunPhase
  history: HistoryMessage[]
}

export interface BackgroundSession {
  readonly id: string
  readonly provider: ProviderName

  start(prompt: string, options?: StartOptions): Promise<TurnHandle>
  getEvents(): Promise<PollResult>
  isRunning(): Promise<boolean>
  cancel(): Promise<void>
}

export interface SessionInternals {
  meta: SessionMeta
  state: SessionState
  sandbox: CodeAgentSandbox
  sessionDir: string
}
