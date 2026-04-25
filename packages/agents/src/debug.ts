/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

const DEBUG_FLAG = "CHARCLAW_AGENTS_DEBUG"

export function isDebugEnabled(): boolean {
  const value = process.env[DEBUG_FLAG] ?? process.env.CODING_AGENTS_DEBUG
  return value === "1" || value === "true"
}

export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.error("[charclaw/agents]", ...args)
  }
}
