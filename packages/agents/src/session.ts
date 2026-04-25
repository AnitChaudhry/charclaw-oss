/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import { randomUUID } from "node:crypto"

import type { CodeAgentSandbox, ProviderName } from "./types/provider.js"
import type { BackgroundSession } from "./background/types.js"
import {
  createSessionImpl,
  emptySessionState,
  persistSession,
  readSessionMeta,
  readSessionState,
  sessionDirFor,
} from "./background/index.js"
import { getAgent, getAgentNames } from "./core/registry.js"
import { debugLog } from "./debug.js"

export interface CreateSessionOptions {
  sandbox: CodeAgentSandbox
  env?: Record<string, string>
  model?: string
  systemPrompt?: string
  cwd?: string
  /** Reserved for compatibility with existing consumers; not currently used. */
  timeout?: number
  /** Optional explicit session ID. If omitted, a random UUID is generated. */
  sessionId?: string
}

export interface SessionOptions {
  sandbox: CodeAgentSandbox
  /** Override the system prompt on a re-attached session. */
  systemPrompt?: string
  /** Override the model on a re-attached session. */
  model?: string
  /** Update env vars on the underlying sandbox before resuming. */
  env?: Record<string, string>
  /** Update the working directory persisted in session metadata. */
  cwd?: string
}

export type { BackgroundSession }

export { getAgentNames }

export async function createSession(
  provider: ProviderName | string,
  options: CreateSessionOptions,
): Promise<BackgroundSession> {
  // Validate provider eagerly (will throw if unknown)
  const def = getAgent(provider as ProviderName)

  const id = options.sessionId ?? randomUUID()
  const sessionDir = sessionDirFor(id)

  if (options.env && Object.keys(options.env).length > 0) {
    options.sandbox.setSessionEnvVars(options.env)
  }

  await options.sandbox.ensureProvider(def.name)

  const meta = {
    id,
    provider: def.name,
    model: options.model,
    systemPrompt: options.systemPrompt,
    cwd: options.cwd,
    createdAt: Date.now(),
  }
  const state = emptySessionState()

  const internals = {
    meta,
    state,
    sandbox: options.sandbox,
    sessionDir,
  }

  await persistSession(internals)
  debugLog("createSession", { id, provider })
  return createSessionImpl(internals)
}

export async function getSession(
  sessionId: string,
  options: SessionOptions,
): Promise<BackgroundSession> {
  const sessionDir = sessionDirFor(sessionId)
  const meta = await readSessionMeta(options.sandbox, sessionDir)
  if (!meta) {
    throw new Error(
      `getSession: no session metadata at ${sessionDir} (was it persisted to this sandbox?)`,
    )
  }
  if (meta.id !== sessionId) {
    throw new Error(
      `getSession: id mismatch — meta.id=${meta.id} requested=${sessionId}`,
    )
  }
  const state = await readSessionState(options.sandbox, sessionDir)

  // Apply re-attach overrides.
  if (options.systemPrompt !== undefined) meta.systemPrompt = options.systemPrompt
  if (options.model !== undefined) meta.model = options.model
  if (options.cwd !== undefined) meta.cwd = options.cwd
  if (options.env && Object.keys(options.env).length > 0) {
    options.sandbox.setSessionEnvVars(options.env)
  }

  const internals = {
    meta,
    state,
    sandbox: options.sandbox,
    sessionDir,
  }
  debugLog("getSession", { id: sessionId, provider: meta.provider })
  return createSessionImpl(internals)
}
