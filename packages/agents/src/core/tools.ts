/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type { ToolName, ToolStartEvent } from "../types/events.js"

export type CanonicalToolName =
  | "shell"
  | "read"
  | "write"
  | "edit"
  | "glob"
  | "grep"
  | "task"
  | "todo"
  | "fetch"

const TOOL_ALIASES: Record<string, CanonicalToolName> = {
  bash: "shell",
  shell: "shell",
  command: "shell",
  exec: "shell",
  read: "read",
  readfile: "read",
  view: "read",
  write: "write",
  writefile: "write",
  create: "write",
  edit: "edit",
  patch: "edit",
  multiedit: "edit",
  replace: "edit",
  glob: "glob",
  find: "glob",
  search: "glob",
  grep: "grep",
  ripgrep: "grep",
  task: "task",
  agent: "task",
  todo: "todo",
  todowrite: "todo",
  fetch: "fetch",
  webfetch: "fetch",
  http: "fetch",
}

export const CANONICAL_DISPLAY_NAMES: Record<CanonicalToolName, string> = {
  shell: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  glob: "Glob",
  grep: "Grep",
  task: "Task",
  todo: "TodoWrite",
  fetch: "WebFetch",
}

export function normalizeToolName(raw: string): ToolName {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  return TOOL_ALIASES[key] ?? raw
}

export function getToolDisplayName(name: string): string {
  const canonical = normalizeToolName(name)
  if (canonical in CANONICAL_DISPLAY_NAMES) {
    return CANONICAL_DISPLAY_NAMES[canonical as CanonicalToolName]
  }
  return name
}

export function createToolStartEvent(rawName: string, input?: unknown, id?: string): ToolStartEvent {
  return {
    type: "tool_start",
    name: normalizeToolName(rawName),
    ...(id ? { id } : {}),
    ...(input !== undefined ? { input } : {}),
  }
}
