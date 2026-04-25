/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Local sandbox: runs agent CLIs directly on the host machine. Uses a
 * POSIX shell (bash) to execute commands, with Git-for-Windows fallback
 * detection so the same interface works on Windows.
 */

import * as fs from "node:fs"
import * as fsp from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { spawn, exec as cpExec } from "node:child_process"
import { promisify } from "node:util"

import type {
  AdaptSandboxOptions,
  CodeAgentSandbox,
  ExecuteBackgroundOptions,
  ExecuteResult,
  PollBackgroundResult,
  ProviderName,
} from "../types/provider.js"
import { debugLog } from "../debug.js"
import {
  ensureCliInstalled,
  getInstallationStatus,
} from "../utils/install.js"

const execAsync = promisify(cpExec)

export interface LocalSandboxOptions extends AdaptSandboxOptions {
  /** Working directory inside the sandbox (defaults to localWorkdir()). */
  cwd?: string
  /** Override the bash binary used on Windows (Git for Windows installs bash.exe). */
  bashPath?: string
}

const WIN_BASH_CANDIDATES = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
]

function resolveBashPath(override?: string): string {
  if (override && fs.existsSync(override)) return override
  if (process.platform !== "win32") return "/bin/bash"
  for (const candidate of WIN_BASH_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  // Fall through; the caller will see ENOENT if bash is missing.
  return "bash"
}

/**
 * Returns the default local workspace directory, optionally joined with
 * additional path segments. Without arguments, returns the base directory
 * (`~/charclaw-workspaces`). With arguments, joins them under the base —
 * useful for organizing per-repo or per-branch checkouts:
 *
 *   localWorkdir() // ~/charclaw-workspaces
 *   localWorkdir("acme", "api", "main") // ~/charclaw-workspaces/acme/api/main
 */
export function localWorkdir(...segments: string[]): string {
  const base = path.join(os.homedir(), "charclaw-workspaces")
  return segments.length > 0 ? path.join(base, ...segments) : base
}

class LocalSandbox implements CodeAgentSandbox {
  private readonly persistent: Record<string, string>
  private readonly transient: Record<string, string>
  private readonly cwd: string
  private readonly bash: string

  constructor(options: LocalSandboxOptions) {
    this.persistent = { ...(options.env ?? {}) }
    this.transient = {}
    this.cwd = options.cwd ?? localWorkdir()
    this.bash = resolveBashPath(options.bashPath)
    fs.mkdirSync(this.cwd, { recursive: true })
  }

  setEnvVars(vars: Record<string, string>): void {
    Object.assign(this.persistent, vars)
  }

  setSessionEnvVars(vars: Record<string, string>): void {
    Object.assign(this.persistent, vars)
  }

  setRunEnvVars(vars: Record<string, string>): void {
    Object.assign(this.transient, vars)
  }

  clearRunEnvVars(): void {
    for (const key of Object.keys(this.transient)) {
      delete this.transient[key]
    }
  }

  private childEnv(): NodeJS.ProcessEnv {
    return { ...process.env, ...this.persistent, ...this.transient }
  }

  async executeCommand(command: string, timeoutSec = 60): Promise<ExecuteResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        shell: this.bash,
        cwd: this.cwd,
        env: this.childEnv(),
        timeout: timeoutSec * 1000,
        maxBuffer: 16 * 1024 * 1024,
      })
      return { exitCode: 0, output: `${stdout}${stderr}` }
    } catch (err: unknown) {
      const e = err as { code?: number; stdout?: string; stderr?: string; message?: string }
      return {
        exitCode: typeof e.code === "number" ? e.code : 1,
        output: `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`,
      }
    }
  }

  async executeBackground(opts: ExecuteBackgroundOptions): Promise<{ pid: number }> {
    await fsp.mkdir(path.dirname(opts.outputFile), { recursive: true })
    const out = fs.openSync(opts.outputFile, "a")
    const sentinel = `${opts.outputFile}.done`

    // Use a wrapper that writes the .done file regardless of how the inner command exits.
    const inner = `${opts.command}; rc=$?; printf 'done\\n' > '${sentinel.replace(/'/g, `'\\''`)}'; exit $rc`

    const child = spawn(this.bash, ["-lc", inner], {
      cwd: opts.cwd ?? this.cwd,
      env: this.childEnv(),
      stdio: ["ignore", out, out],
      detached: true,
      windowsHide: true,
    })
    fs.closeSync(out)
    if (typeof child.pid !== "number") {
      throw new Error("LocalSandbox.executeBackground: failed to obtain pid")
    }
    child.unref()
    debugLog("local executeBackground pid", child.pid)
    return { pid: child.pid }
  }

  async killBackgroundProcess(pid: number, processName?: string): Promise<void> {
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      /* already gone */
    }
    await new Promise(r => setTimeout(r, 400))
    try {
      process.kill(pid, "SIGKILL")
    } catch {
      /* already gone */
    }
    if (processName && process.platform !== "win32") {
      await execAsync(`pkill -KILL -f '${processName.replace(/'/g, `'\\''`)}' 2>/dev/null || true`, {
        shell: this.bash,
      }).catch(() => undefined)
    }
  }

  async pollBackgroundState(sessionDir: string): Promise<PollBackgroundResult | null> {
    const metaPath = path.join(sessionDir, "meta.json")
    let metaRaw: string
    try {
      metaRaw = await fsp.readFile(metaPath, "utf-8")
    } catch {
      return null
    }

    let outputFile: string | undefined
    let pid: number | undefined
    try {
      const parsed = JSON.parse(metaRaw) as { outputFile?: string; pid?: number }
      outputFile = parsed.outputFile
      pid = parsed.pid
    } catch {
      return null
    }
    if (!outputFile) return { meta: metaRaw, output: "", done: false }

    const doneSentinel = `${outputFile}.done`
    let output = ""
    try {
      output = await fsp.readFile(outputFile, "utf-8")
    } catch {
      output = ""
    }

    let sentinelDone = false
    try {
      await fsp.access(doneSentinel)
      sentinelDone = true
    } catch {
      sentinelDone = false
    }

    const alive = pid !== undefined ? isProcessAlive(pid) : false
    const done = sentinelDone || (pid !== undefined && !alive)
    return { meta: metaRaw, output, done }
  }

  async ensureProvider(name: ProviderName): Promise<void> {
    const { binary } = getInstallationStatus(name)
    const exec = (cmd: string, timeoutSec?: number) => this.executeCommand(cmd, timeoutSec ?? 60)
    await ensureCliInstalled(name, { exec, timeoutSec: 180 })
    debugLog("local ensureProvider ok", name, "binary", binary)
  }

  async writeFile(filePath: string, contents: string | Buffer): Promise<void> {
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
    await fsp.writeFile(filePath, contents)
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 is a no-op; throws if the process doesn't exist.
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function createLocalSandbox(options: LocalSandboxOptions = {}): CodeAgentSandbox {
  return new LocalSandbox(options)
}
