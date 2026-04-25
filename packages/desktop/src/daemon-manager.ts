/**
 * Manages the embedded daemon child process.
 * In dev mode: daemon connects to localhost:3000.
 * In production: daemon connects to the bundled Next.js server.
 */

import { ChildProcess, spawn } from "node:child_process"
import path from "node:path"
import { app } from "electron"

let daemonProc: ChildProcess | null = null

function daemonBinary(): string {
  if (app.isPackaged) {
    // Bundled binary in extraResources
    return path.join(process.resourcesPath, "daemon", "index.js")
  }
  // Dev mode: use the compiled daemon from packages/daemon/dist
  return path.join(__dirname, "../../daemon/dist/index.js")
}

export function startDaemon(serverUrl: string): void {
  if (daemonProc) return

  const bin = daemonBinary()
  daemonProc = spawn(process.execPath, [bin, "start"], {
    env: { ...process.env, TENXMENTOR_SERVER: serverUrl },
    stdio: ["ignore", "pipe", "pipe"],
  })

  daemonProc.stdout?.on("data", (d: Buffer) => {
    process.stdout.write(`[daemon] ${d.toString()}`)
  })
  daemonProc.stderr?.on("data", (d: Buffer) => {
    process.stderr.write(`[daemon] ${d.toString()}`)
  })
  daemonProc.on("exit", (code) => {
    console.log(`[daemon-manager] Daemon exited with code ${code}`)
    daemonProc = null
  })

  console.log("[daemon-manager] Daemon started")
}

export function stopDaemon(): void {
  if (!daemonProc) return
  daemonProc.kill("SIGTERM")
  daemonProc = null
  console.log("[daemon-manager] Daemon stopped")
}
