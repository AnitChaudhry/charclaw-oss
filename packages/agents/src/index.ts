/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version. See LICENSE.
 *
 * @example
 * ```ts
 * import { Daytona } from "@daytonaio/sdk"
 * import { adaptDaytonaSandbox, createSession } from "@charclaw/agents"
 *
 * const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
 * const sandbox = await daytona.create()
 * const adapted = adaptDaytonaSandbox(sandbox)
 *
 * const session = await createSession("claude", {
 *   sandbox: adapted,
 *   env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
 *   model: "sonnet",
 * })
 *
 * await session.start("Refactor the auth module")
 * while ((await session.getEvents()).running) {
 *   await new Promise(r => setTimeout(r, 1000))
 * }
 * await sandbox.delete()
 * ```
 */

// Side-effect import: registers all bundled agents into the registry.
import "./agents/index.js"

// ─── Event types ─────────────────────────────────────────────────────────────
export type {
  Event,
  SessionEvent,
  TokenEvent,
  ToolStartEvent,
  ToolDeltaEvent,
  ToolEndEvent,
  EndEvent,
  AgentCrashedEvent,
  EventType,
  ToolName,
  ShellToolInput,
  ReadToolInput,
  WriteToolInput,
  EditToolInput,
  GlobToolInput,
  GrepToolInput,
  ToolInputMap,
} from "./types/events.js"

// ─── Sandbox types ───────────────────────────────────────────────────────────
export type {
  CodeAgentSandbox,
  AdaptSandboxOptions,
  ExecuteBackgroundOptions,
  PollBackgroundResult,
  ExecuteResult,
  ProviderName,
} from "./types/provider.js"

// ─── Core agent / tool types ─────────────────────────────────────────────────
export type {
  AgentDefinition,
  BuildCommandContext,
  ParseState,
  ParseResult,
} from "./core/agent.js"

export type { CanonicalToolName } from "./core/tools.js"

// ─── Background session types ────────────────────────────────────────────────
export type {
  BackgroundSession,
  BackgroundRunPhase,
  TurnHandle,
  PollResult,
  HistoryMessage,
  SessionMeta,
  SessionState,
  StartOptions,
} from "./background/index.js"

// ─── Session API (main entry point) ──────────────────────────────────────────
export {
  createSession,
  getSession,
  getAgentNames,
} from "./session.js"

export type { CreateSessionOptions, SessionOptions } from "./session.js"

// ─── Registry ────────────────────────────────────────────────────────────────
export { registry, getAgent } from "./core/registry.js"

// ─── Tool helpers ────────────────────────────────────────────────────────────
export {
  normalizeToolName,
  createToolStartEvent,
  getToolDisplayName,
  CANONICAL_DISPLAY_NAMES,
} from "./core/tools.js"

// ─── Agent definitions (for consumers who want the registry-less form) ───────
export {
  claudeAgent,
  codexAgent,
  geminiAgent,
  gooseAgent,
  opencodeAgent,
  piAgent,
  mockAgent,
} from "./agents/index.js"

// ─── Sandbox adapters ────────────────────────────────────────────────────────
export {
  adaptDaytonaSandbox,
  adaptSandbox,
  createLocalSandbox,
  localWorkdir,
} from "./sandbox/index.js"

export type { LocalSandboxOptions } from "./sandbox/index.js"

// ─── Utilities ───────────────────────────────────────────────────────────────
export {
  safeJsonParse,
  splitLines,
  getPackageName,
  getShellInstaller,
  getBinaryName,
  getInstallationStatus,
  installProvider,
  isCliInstalled,
  ensureCliInstalled,
} from "./utils/index.js"

// ─── Debug ───────────────────────────────────────────────────────────────────
export { isDebugEnabled, debugLog } from "./debug.js"
