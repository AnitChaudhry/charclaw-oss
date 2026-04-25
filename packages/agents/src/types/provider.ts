/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

export type ProviderName =
  | "claude"
  | "codex"
  | "gemini"
  | "goose"
  | "opencode"
  | "pi"
  | "mock"

export interface ExecuteBackgroundOptions {
  command: string
  outputFile: string
  cwd?: string
  /** Caller-supplied identifier for log correlation; not interpreted by the SDK. */
  runId?: string
  /** Soft timeout in seconds. Kept opaque here — adapters may or may not enforce. */
  timeout?: number
}

export interface PollBackgroundResult {
  meta: string | null
  output: string
  done: boolean
}

export interface ExecuteResult {
  exitCode: number
  output: string
}

/**
 * Sandbox abstraction. A sandbox is an environment in which an agent CLI runs.
 * Implementations: Daytona (cloud) and local (host machine).
 */
export interface CodeAgentSandbox {
  setEnvVars(vars: Record<string, string>): void
  setSessionEnvVars(vars: Record<string, string>): void
  setRunEnvVars(vars: Record<string, string>): void
  clearRunEnvVars(): void

  executeCommand(command: string, timeout?: number): Promise<ExecuteResult>
  executeBackground(opts: ExecuteBackgroundOptions): Promise<{ pid: number }>
  killBackgroundProcess(pid: number, processName?: string): Promise<void>
  pollBackgroundState(sessionDir: string): Promise<PollBackgroundResult | null>
  ensureProvider(name: ProviderName): Promise<void>

  /** Optional: write a file inside the sandbox (used for credentials, configs). */
  writeFile?(path: string, contents: string | Buffer): Promise<void>
}

export interface AdaptSandboxOptions {
  /** Initial environment variables visible to every command run in the sandbox. */
  env?: Record<string, string>
}
