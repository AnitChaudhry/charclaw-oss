/**
 * Periodic heartbeat — tells the server this runtime is alive and reports capabilities.
 */

import { detectCapabilities } from "./cli-detector.js"
import type { DaemonConfig } from "./config.js"

const INTERVAL_MS = 25_000 // 25s — well within server's 30s TTL check

export interface HeartbeatExtras {
  /** Port of the local terminal WebSocket server, if running. */
  terminalWsPort?: number | null
}

let currentExtras: HeartbeatExtras = {}

/**
 * Update info attached to every subsequent heartbeat. Called by the
 * daemon during startup once the terminal server has an assigned port.
 */
export function setHeartbeatExtras(extras: HeartbeatExtras): void {
  currentExtras = { ...currentExtras, ...extras }
}

export async function sendHeartbeat(config: DaemonConfig): Promise<void> {
  const capabilities = await detectCapabilities()
  const res = await fetch(`${config.serverUrl}/api/runtime/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.daemonToken}`,
    },
    body: JSON.stringify({
      runtimeId: config.runtimeId,
      capabilities: { ...capabilities, ...currentExtras },
    }),
  })
  if (!res.ok) {
    console.warn(`[heartbeat] Server responded ${res.status}`)
  }
}

export function startHeartbeat(config: DaemonConfig): () => void {
  // Send immediately on start
  sendHeartbeat(config).catch((err) =>
    console.error("[heartbeat] initial send failed:", err)
  )

  const timer = setInterval(() => {
    sendHeartbeat(config).catch((err) =>
      console.error("[heartbeat] send failed:", err)
    )
  }, INTERVAL_MS)

  return () => clearInterval(timer)
}
