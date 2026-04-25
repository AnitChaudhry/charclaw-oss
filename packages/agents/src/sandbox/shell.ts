/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

/**
 * Quote a string safely for single-quoted POSIX shell expansion.
 * Replaces ' with '\'' so the value can be wrapped in single quotes.
 */
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Render a key/value map into `export K=V; export K2=V2;` exports. */
export function envExports(env: Record<string, string>): string {
  const entries = Object.entries(env)
  if (entries.length === 0) return ""
  return entries.map(([k, v]) => `export ${k}=${shellSingleQuote(v)}`).join("; ") + ";"
}

/** Compose a shell pipeline that prepends env exports to a command. */
export function withEnv(env: Record<string, string>, command: string): string {
  const prefix = envExports(env)
  return prefix ? `${prefix} ${command}` : command
}
