/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type {
  BackgroundSession,
  PollResult,
  SessionInternals,
  SessionMeta,
  SessionState,
  StartOptions,
  TurnHandle,
} from "./types.js"
import type { Event } from "../types/events.js"
import type { CodeAgentSandbox } from "../types/provider.js"
import { getAgent } from "../core/registry.js"
import { emptyParseState } from "../core/agent.js"
import { shellSingleQuote } from "../sandbox/shell.js"
import { debugLog } from "../debug.js"

const SESSIONS_BASE = "~/.charclaw-sessions"

export function sessionDirFor(id: string): string {
  return `${SESSIONS_BASE}/${id}`
}

class BackgroundSessionImpl implements BackgroundSession {
  private internals: SessionInternals

  constructor(internals: SessionInternals) {
    this.internals = internals
  }

  get id(): string {
    return this.internals.meta.id
  }

  get provider() {
    return this.internals.meta.provider
  }

  async start(prompt: string, options: StartOptions = {}): Promise<TurnHandle> {
    const { meta, sandbox, sessionDir } = this.internals
    const def = getAgent(meta.provider)

    if (options.env && Object.keys(options.env).length > 0) {
      sandbox.setRunEnvVars(options.env)
    }

    const turnId = `t${Date.now()}`
    const outputFile = `${sessionDir}/${turnId}.log`
    const command = def.buildCommand({
      cwd: meta.cwd ?? sessionDir,
      model: meta.model,
      systemPrompt: meta.systemPrompt,
      prompt,
    })

    const seedHistory = options.history ?? this.internals.state.history
    this.internals.state = {
      currentTurn: undefined,
      parserPosition: 0,
      parserBuffer: "",
      parserScratch: {},
      phase: "starting",
      history: [
        ...seedHistory,
        { role: "user", content: prompt, timestamp: Date.now() },
      ],
    }

    const { pid } = await sandbox.executeBackground({
      command,
      outputFile,
      cwd: meta.cwd,
      runId: turnId,
    })

    const turn: TurnHandle = {
      pid,
      outputFile,
      startedAt: Date.now(),
      turnId,
    }
    this.internals.state.currentTurn = turn
    this.internals.state.phase = "running"
    await persistSession(this.internals)
    debugLog("session.start", { id: meta.id, turnId, pid })
    return turn
  }

  async getEvents(): Promise<PollResult> {
    const { meta, sandbox, sessionDir } = this.internals
    if (!this.internals.state.currentTurn) {
      return {
        events: [],
        running: false,
        sessionId: meta.id,
        cursor: cursorOf(this.internals.state),
        runPhase: this.internals.state.phase,
      }
    }

    const poll = await sandbox.pollBackgroundState(sessionDir)
    if (!poll) {
      return {
        events: [],
        running: false,
        sessionId: meta.id,
        cursor: cursorOf(this.internals.state),
        runPhase: this.internals.state.phase,
      }
    }

    const def = getAgent(meta.provider)
    const fullOutput = poll.output
    const newSlice = fullOutput.slice(this.internals.state.parserPosition)

    const parserState = {
      position: this.internals.state.parserPosition,
      buffer: this.internals.state.parserBuffer,
      scratch: this.internals.state.parserScratch,
    }

    const { events, state: nextState } = def.parseEvents(newSlice, parserState)

    this.internals.state.parserPosition = fullOutput.length
    this.internals.state.parserBuffer = nextState.buffer
    this.internals.state.parserScratch = nextState.scratch

    if (poll.done) {
      this.internals.state.phase = endPhase(events)
      sandbox.clearRunEnvVars()
      const assistantText = events
        .filter((e: Event) => e.type === "token")
        .map(e => (e as { text: string }).text)
        .join("")
      if (assistantText) {
        this.internals.state.history.push({
          role: "assistant",
          content: assistantText,
          timestamp: Date.now(),
        })
      }
    }

    await persistSession(this.internals)

    return {
      events,
      running: !poll.done,
      sessionId: meta.id,
      cursor: cursorOf(this.internals.state),
      runPhase: this.internals.state.phase,
    }
  }

  async isRunning(): Promise<boolean> {
    const result = await this.getEvents()
    return result.running
  }

  async cancel(): Promise<void> {
    const turn = this.internals.state.currentTurn
    if (!turn) return
    const def = getAgent(this.internals.meta.provider)
    const binaryName = def.binaryName ?? def.name
    await this.internals.sandbox.killBackgroundProcess(turn.pid, binaryName)
    this.internals.sandbox.clearRunEnvVars()
    this.internals.state.phase = "cancelled"
    await persistSession(this.internals)
  }
}

function cursorOf(state: SessionState): string {
  return `${state.parserPosition}:${state.currentTurn?.turnId ?? ""}`
}

function endPhase(events: Event[]): "completed" | "crashed" {
  const crashed = events.find(e => e.type === "agent_crashed")
  if (crashed) return "crashed"
  const last = events[events.length - 1]
  if (last && last.type === "end" && (last as { error?: string }).error) {
    return "crashed"
  }
  return "completed"
}

export function createSessionImpl(internals: SessionInternals): BackgroundSession {
  return new BackgroundSessionImpl(internals)
}

export function emptySessionState(): SessionState {
  return {
    parserPosition: 0,
    parserBuffer: "",
    parserScratch: emptyParseState().scratch,
    phase: "idle",
    history: [],
  }
}

/**
 * Persist meta.json + state.json by issuing a shell command in the sandbox.
 * Small documents — a single command per file is fine.
 */
export async function persistSession(internals: SessionInternals): Promise<void> {
  const metaPath = `${internals.sessionDir}/session.json`
  const statePath = `${internals.sessionDir}/state.json`
  const metaJson = JSON.stringify(internals.meta)
  const stateJson = JSON.stringify(internals.state)

  const cmd =
    `mkdir -p ${shellSingleQuote(internals.sessionDir)}; ` +
    `printf '%s' ${shellSingleQuote(metaJson)} > ${shellSingleQuote(metaPath)}; ` +
    `printf '%s' ${shellSingleQuote(stateJson)} > ${shellSingleQuote(statePath)}`

  await internals.sandbox.executeCommand(cmd, 15)
}

export async function readSessionMeta(
  sandbox: CodeAgentSandbox,
  sessionDir: string,
): Promise<SessionMeta | null> {
  const res = await sandbox.executeCommand(
    `cat ${shellSingleQuote(`${sessionDir}/session.json`)} 2>/dev/null`,
    10,
  )
  const raw = (res.output ?? "").trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionMeta
  } catch {
    return null
  }
}

export async function readSessionState(
  sandbox: CodeAgentSandbox,
  sessionDir: string,
): Promise<SessionState> {
  const res = await sandbox.executeCommand(
    `cat ${shellSingleQuote(`${sessionDir}/state.json`)} 2>/dev/null`,
    10,
  )
  const raw = (res.output ?? "").trim()
  if (!raw) return emptySessionState()
  try {
    return JSON.parse(raw) as SessionState
  } catch {
    return emptySessionState()
  }
}
