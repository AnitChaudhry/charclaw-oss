/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 *
 * Licensed under the GNU Affero General Public License v3.0 or later.
 * See LICENSE in the project root for full terms.
 */

export type EventType =
  | "session"
  | "token"
  | "tool_start"
  | "tool_delta"
  | "tool_end"
  | "end"
  | "agent_crashed"

export interface SessionEvent {
  type: "session"
  id: string
}

export interface TokenEvent {
  type: "token"
  text: string
}

export type ToolName =
  | "shell"
  | "read"
  | "write"
  | "edit"
  | "glob"
  | "grep"
  | "task"
  | "todo"
  | "fetch"
  | string

export interface ShellToolInput {
  command: string
  description?: string
  timeout?: number
}

export interface ReadToolInput {
  path: string
  offset?: number
  limit?: number
}

export interface WriteToolInput {
  path: string
  content: string
}

export interface EditToolInput {
  path: string
  oldString: string
  newString: string
  replaceAll?: boolean
}

export interface GlobToolInput {
  pattern: string
  path?: string
}

export interface GrepToolInput {
  pattern: string
  path?: string
  glob?: string
}

export interface ToolInputMap {
  shell: ShellToolInput
  read: ReadToolInput
  write: WriteToolInput
  edit: EditToolInput
  glob: GlobToolInput
  grep: GrepToolInput
}

export interface ToolStartEvent {
  type: "tool_start"
  name: ToolName
  id?: string
  input?: unknown
}

export interface ToolDeltaEvent {
  type: "tool_delta"
  id?: string
  text: string
}

export interface ToolEndEvent {
  type: "tool_end"
  name?: ToolName
  id?: string
  output?: string
  isError?: boolean
}

export interface EndEvent {
  type: "end"
  error?: string
}

export interface AgentCrashedEvent {
  type: "agent_crashed"
  message?: string
  output?: string
}

export type Event =
  | SessionEvent
  | TokenEvent
  | ToolStartEvent
  | ToolDeltaEvent
  | ToolEndEvent
  | EndEvent
  | AgentCrashedEvent
