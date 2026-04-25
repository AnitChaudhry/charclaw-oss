/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

export {
  getPackageName,
  getShellInstaller,
  getBinaryName,
  getInstallationStatus,
  installProvider,
  isCliInstalled,
  ensureCliInstalled,
} from "./install.js"

export function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Yield each complete line in a chunk; trailing partial line is returned as `remainder`. */
export function splitLines(input: string): { lines: string[]; remainder: string } {
  const idx = input.lastIndexOf("\n")
  if (idx < 0) return { lines: [], remainder: input }
  const head = input.slice(0, idx)
  const remainder = input.slice(idx + 1)
  const lines = head.split("\n").filter(l => l.length > 0)
  return { lines, remainder }
}
