/**
 * Detects which AI agent CLIs are installed and reachable on PATH.
 * Probes each detected CLI for its `--version` output too, so the server
 * can surface "claude-code 1.2.3" rather than just "claude-code installed".
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import os from "node:os"

const execFileAsync = promisify(execFile)

const AGENTS = [
  { name: "claude-code", binary: "claude" },
  { name: "codex",       binary: "codex" },
  { name: "opencode",    binary: "opencode" },
  { name: "gemini",      binary: "gemini" },
  { name: "goose",       binary: "goose" },
  { name: "pi",          binary: "pi" },
] as const

export type AgentName = (typeof AGENTS)[number]["name"]

async function commandExists(bin: string): Promise<boolean> {
  const which = os.platform() === "win32" ? "where" : "which"
  try {
    await execFileAsync(which, [bin], { timeout: 5000 })
    return true
  } catch {
    // Also check ~/.local/bin (goose install location)
    try {
      const localBin = `${os.homedir()}/.local/bin/${bin}`
      const { statSync } = await import("node:fs")
      statSync(localBin)
      return true
    } catch {
      return false
    }
  }
}

const SEMVER_RE = /v?(\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?)/

/**
 * Run `<bin> --version` and pull the first semver-ish token out of stdout/stderr.
 * Returns null if the probe fails, times out, or no version-like token appears.
 * Some CLIs print to stderr or wrap the version in marketing text; that's fine —
 * we just look for the first `1.2.3`-shaped token in either stream.
 */
async function probeVersion(bin: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, ["--version"], {
      timeout: 5000,
      // Native exes (not .cmd) on Windows; spawn directly without shell.
      shell: os.platform() === "win32",
      windowsHide: true,
    })
    const haystack = `${stdout ?? ""}\n${stderr ?? ""}`
    const match = SEMVER_RE.exec(haystack)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function detectAgents(): Promise<AgentName[]> {
  const results = await Promise.all(
    AGENTS.map(async (a) => ({
      name: a.name,
      available: await commandExists(a.binary),
    }))
  )
  return results.filter((r) => r.available).map((r) => r.name)
}

export async function detectCapabilities(): Promise<{
  agents: AgentName[]
  agentVersions: Record<string, string | null>
  freeDiskGb: number
  platform: string
}> {
  const presence = await Promise.all(
    AGENTS.map(async (a) => ({
      name: a.name,
      binary: a.binary,
      available: await commandExists(a.binary),
    }))
  )

  // Probe versions only for installed CLIs — saves ~5×N seconds in the worst case.
  const installed = presence.filter((p) => p.available)
  const versionEntries = await Promise.all(
    installed.map(async (p) => [p.name, await probeVersion(p.binary)] as const)
  )

  const agents = installed.map((p) => p.name)
  const agentVersions = Object.fromEntries(versionEntries) as Record<string, string | null>

  const platform = `${os.platform()}/${os.arch()}`

  // Best-effort disk space check
  let freeDiskGb = 0
  try {
    const { execSync } = await import("node:child_process")
    if (os.platform() !== "win32") {
      const out = execSync("df -BG / | tail -1 | awk '{print $4}'").toString().trim()
      freeDiskGb = parseInt(out.replace("G", ""), 10) || 0
    }
  } catch { /* not critical */ }

  return { agents, agentVersions, freeDiskGb, platform }
}
