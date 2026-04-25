/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Adapter wrapping a Daytona Sandbox (from @daytonaio/sdk) into the
 * CodeAgentSandbox interface used by CharClaw sessions. Built against
 * the Daytona SDK's public API — sandbox.process.executeCommand and
 * sandbox.fs.uploadFile — and standard POSIX shell idioms (nohup,
 * background detach, .done sentinel files for completion).
 */

import type { Sandbox } from "@daytonaio/sdk"
import type {
  AdaptSandboxOptions,
  CodeAgentSandbox,
  ExecuteBackgroundOptions,
  ExecuteResult,
  PollBackgroundResult,
  ProviderName,
} from "../types/provider.js"
import { debugLog } from "../debug.js"
import { withEnv, shellSingleQuote } from "./shell.js"
import {
  ensureCliInstalled,
  getBinaryName,
} from "../utils/install.js"

const DEFAULT_BG_TIMEOUT_SEC = 30
const DEFAULT_KILL_GRACE_MS = 500

class DaytonaSandboxAdapter implements CodeAgentSandbox {
  private readonly sandbox: Sandbox
  private readonly persistent: Record<string, string>
  private readonly transient: Record<string, string>

  constructor(sandbox: Sandbox, options: AdaptSandboxOptions) {
    this.sandbox = sandbox
    this.persistent = { ...(options.env ?? {}) }
    this.transient = {}
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

  private currentEnv(): Record<string, string> {
    return { ...this.persistent, ...this.transient }
  }

  async executeCommand(command: string, timeoutSec = 60): Promise<ExecuteResult> {
    const wrapped = withEnv(this.currentEnv(), command)
    const result = await this.sandbox.process.executeCommand(
      wrapped,
      undefined,
      undefined,
      timeoutSec,
    )
    return {
      exitCode: result.exitCode ?? 0,
      output: result.result ?? "",
    }
  }

  async executeBackground(opts: ExecuteBackgroundOptions): Promise<{ pid: number }> {
    const cdPart = opts.cwd ? `cd ${shellSingleQuote(opts.cwd)} && ` : ""
    const wrapped = withEnv(this.currentEnv(), `${cdPart}${opts.command}`)
    const inner = shellSingleQuote(
      `${wrapped} >> ${shellSingleQuote(opts.outputFile)} 2>&1; ` +
        `echo done > ${shellSingleQuote(opts.outputFile + ".done")}`,
    )
    // nohup + background + print PID. Stdio of the wrapper is detached so we
    // can read the PID synchronously on stdout.
    const launcher = `nohup sh -c ${inner} > /dev/null 2>&1 & echo $!`
    const result = await this.sandbox.process.executeCommand(
      launcher,
      undefined,
      undefined,
      DEFAULT_BG_TIMEOUT_SEC,
    )
    const tokens = (result.result ?? "").trim().split(/\s+/)
    const pidStr = tokens[tokens.length - 1] ?? ""
    const pid = Number.parseInt(pidStr, 10)
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new Error(
        `Daytona executeBackground: failed to parse PID; got "${(result.result ?? "").slice(0, 200)}"`,
      )
    }
    debugLog("daytona executeBackground pid", pid)
    return { pid }
  }

  async killBackgroundProcess(pid: number, processName?: string): Promise<void> {
    // SIGTERM, brief grace, SIGKILL the process and its group.
    await this.sandbox.process.executeCommand(`kill -TERM ${pid} 2>/dev/null || true`)
    await new Promise(r => setTimeout(r, DEFAULT_KILL_GRACE_MS))
    await this.sandbox.process.executeCommand(
      `kill -KILL ${pid} 2>/dev/null || true; ` +
        `kill -KILL -${pid} 2>/dev/null || true`,
    )
    if (processName) {
      const escaped = shellSingleQuote(processName)
      await this.sandbox.process.executeCommand(`pkill -KILL -f ${escaped} 2>/dev/null || true`)
    }
  }

  async pollBackgroundState(sessionDir: string): Promise<PollBackgroundResult | null> {
    const metaPath = `${sessionDir}/meta.json`
    const metaCmd = `cat ${shellSingleQuote(metaPath)} 2>/dev/null`
    const metaRes = await this.sandbox.process.executeCommand(metaCmd, undefined, undefined, 10)
    const metaRaw = (metaRes.result ?? "").trim()
    if (!metaRaw) return null

    let outputFile: string | undefined
    let pid: number | undefined
    try {
      const parsed = JSON.parse(metaRaw) as { outputFile?: string; pid?: number }
      outputFile = parsed.outputFile
      pid = parsed.pid
    } catch {
      return null
    }
    if (!outputFile) {
      return { meta: metaRaw, output: "", done: false }
    }

    // Combined: existence of .done sentinel, liveness of pid (if known), and the output.
    // We probe the process state to distinguish a clean finish from a crash/zombie.
    const doneSentinel = `${outputFile}.done`
    const livenessProbe = pid !== undefined
      ? `STATE=$(ps -p ${pid} -o state= 2>/dev/null); ` +
        `if [ -n "$STATE" ] && [ "$STATE" != "Z" ]; then echo "ALIVE=1"; else echo "ALIVE=0"; fi`
      : `echo "ALIVE=0"`
    const probe =
      `if [ -f ${shellSingleQuote(doneSentinel)} ]; then echo "DONE=1"; else echo "DONE=0"; fi; ` +
      `${livenessProbe}; ` +
      `cat ${shellSingleQuote(outputFile)} 2>/dev/null || true`

    const res = await this.sandbox.process.executeCommand(probe, undefined, undefined, 30)
    const text = res.result ?? ""
    const lines = text.split("\n")
    const doneLine = lines[0]?.trim() ?? ""
    const aliveLine = lines[1]?.trim() ?? ""
    const output = lines.slice(2).join("\n")

    const sentinelDone = doneLine === "DONE=1"
    const processAlive = aliveLine === "ALIVE=1"
    // Either the sentinel exists (clean finish) or the process is gone (crash/kill).
    const done = sentinelDone || (pid !== undefined && !processAlive)

    return { meta: metaRaw, output, done }
  }

  async ensureProvider(name: ProviderName): Promise<void> {
    const exec = (cmd: string, timeoutSec?: number) =>
      this.sandbox.process
        .executeCommand(cmd, undefined, undefined, timeoutSec ?? 60)
        .then(r => ({ exitCode: r.exitCode ?? 0, output: r.result ?? "" }))

    // goose ships into ~/.local/bin which isn't always on PATH
    if (name === "goose") {
      const probe = await exec(`command -v goose || test -x "$HOME/.local/bin/goose"`)
      if (probe.exitCode === 0) return
      await ensureCliInstalled(name, { exec, timeoutSec: 180 })
      await exec(
        `grep -q '\\.local/bin' ~/.bashrc 2>/dev/null || ` +
          `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`,
      )
      await exec(
        `mkdir -p ~/.config/goose && ` +
          `test -f ~/.config/goose/config.yaml || ` +
          `printf 'GOOSE_PROVIDER: openai\\nGOOSE_MODEL: gpt-4o\\nGOOSE_MODE: auto\\n' ` +
          `> ~/.config/goose/config.yaml`,
      )
      return
    }

    await ensureCliInstalled(name, { exec, timeoutSec: 180 })

    if (name === "gemini") {
      await exec("mkdir -p ~/.gemini")
    }
    debugLog("ensureProvider ok", name, "binary", getBinaryName(name))
  }

  async writeFile(path: string, contents: string | Buffer): Promise<void> {
    const buf = typeof contents === "string" ? Buffer.from(contents, "utf-8") : contents
    await this.sandbox.fs.uploadFile(buf, path)
  }
}

export function adaptDaytonaSandbox(
  sandbox: Sandbox,
  options: AdaptSandboxOptions = {},
): CodeAgentSandbox {
  return new DaytonaSandboxAdapter(sandbox, options)
}
