/**
 * Registers this machine as a Runtime with the CharClaw server.
 * Called once during `charclaw setup`.
 */

import os from "node:os"
import { detectCapabilities } from "./cli-detector.js"
import { writeConfig, defaultWorkspaceRoot } from "./config.js"
import type { DaemonConfig } from "./config.js"

export async function register(opts: {
  serverUrl: string
  setupToken: string         // one-time token from the web app Settings → Runtimes page
  workspaceRoot?: string
  name?: string
}): Promise<DaemonConfig> {
  const capabilities = await detectCapabilities()
  const workspaceRoot = opts.workspaceRoot ?? defaultWorkspaceRoot()
  const name = opts.name ?? `${os.hostname()} (${capabilities.platform})`

  const res = await fetch(`${opts.serverUrl}/api/runtime/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setupToken: opts.setupToken,
      name,
      workspaceRoot,
      capabilities,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Registration failed (${res.status}): ${body}`)
  }

  const { runtimeId, daemonToken } = (await res.json()) as {
    runtimeId: string
    daemonToken: string
  }

  const config: DaemonConfig = {
    serverUrl: opts.serverUrl,
    daemonToken,
    runtimeId,
    workspaceRoot,
    name,
  }

  writeConfig(config)
  return config
}
