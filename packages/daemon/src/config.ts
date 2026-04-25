/**
 * Daemon config — persisted at ~/.charclaw/config.json
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const CONFIG_DIR = path.join(os.homedir(), ".charclaw")
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json")

export interface DaemonConfig {
  serverUrl: string        // e.g. http://localhost:3000 or https://app.charclaw.ai
  daemonToken: string      // Bearer token issued by the server at registration
  runtimeId: string        // UUID assigned by server
  workspaceRoot: string    // base dir for git clones, default ~/charclaw-workspaces
  name: string             // human-readable name for this runtime
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE)
}

export function readConfig(): DaemonConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Daemon not configured. Run: charclaw setup`)
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as DaemonConfig
}

export function writeConfig(config: DaemonConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8")
}

export function defaultWorkspaceRoot(): string {
  return path.join(os.homedir(), "charclaw-workspaces")
}
