/**
 * Local-runtime terminal WebSocket server.
 *
 * Exposes a localhost-only WebSocket that spawns an interactive shell
 * (PTY when @lydell/node-pty is available, plain child_process otherwise)
 * and bridges bytes to/from the connected xterm.js client in the web UI.
 *
 * Protocol:
 *   ws://127.0.0.1:<port>/term?sandboxId=<id>&token=<hmac>&cwd=<path>
 *
 * The web server signs (sandboxId, expiresAt) with the daemon's token so
 * only requests originating from the server associated with this daemon
 * can open a shell. Connections without a valid token are rejected.
 *
 * Messages (JSON envelopes — matches the xterm.js client used by Daytona too):
 *   - client → server: {type: "input", payload: "<text>"}
 *   - client → server: {type: "resize", cols: <n>, rows: <n>}
 *   - server → client: {type: "data", payload: "<text>"}
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { WebSocketServer } from "ws"
import type { WebSocket } from "ws"
import { spawn } from "node:child_process"
import os from "node:os"
import type { DaemonConfig } from "./config.js"

// node-pty is optional — lazy-import so missing native build doesn't
// kill the daemon on platforms without build tools.
type PtyModule = typeof import("@lydell/node-pty") | null
let cachedPty: PtyModule | undefined
async function tryLoadPty(): Promise<PtyModule> {
  if (cachedPty !== undefined) return cachedPty
  try {
    const mod = await import("@lydell/node-pty")
    cachedPty = mod
  } catch {
    cachedPty = null
  }
  return cachedPty
}

export interface TerminalServerHandle {
  port: number
  stop: () => void
}

/**
 * Sign a short-lived token that authorizes a single terminal session.
 * Used by the web server (which shares `config.daemonToken`) when handing
 * the URL to the browser.
 */
export function signTerminalToken(
  daemonToken: string,
  sandboxId: string,
  expiresAt: number,
): string {
  const payload = `${sandboxId}.${expiresAt}`
  return createHmac("sha256", daemonToken).update(payload).digest("hex")
}

function verifyTerminalToken(
  daemonToken: string,
  sandboxId: string,
  expiresAt: number,
  token: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  const expected = signTerminalToken(daemonToken, sandboxId, expiresAt)
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(token, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

function pickShell(): { cmd: string; args: string[] } {
  if (os.platform() === "win32") {
    return {
      cmd: process.env.ComSpec || "cmd.exe",
      args: [],
    }
  }
  return { cmd: process.env.SHELL || "/bin/bash", args: ["-l"] }
}

export async function startTerminalServer(
  config: DaemonConfig,
): Promise<TerminalServerHandle> {
  const wss = new WebSocketServer({
    host: "127.0.0.1",
    port: 0, // ephemeral
  })
  const pty = await tryLoadPty()

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1`)
    if (url.pathname !== "/term") {
      ws.close(1008, "unknown path")
      return
    }

    const sandboxId = url.searchParams.get("sandboxId") ?? ""
    const expiresAtRaw = url.searchParams.get("expiresAt") ?? "0"
    const token = url.searchParams.get("token") ?? ""
    const expiresAt = Number.parseInt(expiresAtRaw, 10)
    const cwd = url.searchParams.get("cwd") || config.workspaceRoot

    if (!sandboxId || !verifyTerminalToken(config.daemonToken, sandboxId, expiresAt, token)) {
      ws.close(1008, "invalid token")
      return
    }

    const { cmd, args } = pickShell()
    console.log(`[terminal] new session sandbox=${sandboxId} shell=${cmd} cwd=${cwd}`)

    const sendData = (payload: string): void => {
      try {
        ws.send(JSON.stringify({ type: "data", payload }))
      } catch {
        /* ws may be closing */
      }
    }

    type ClientMessage =
      | { type: "input"; payload: string }
      | { type: "resize"; cols: number; rows: number }

    const parseClientMessage = (raw: Buffer): ClientMessage | null => {
      const txt = raw.toString("utf8").trim()
      if (!txt.startsWith("{")) return null
      try {
        const parsed = JSON.parse(txt) as ClientMessage
        if (parsed && typeof parsed === "object" && "type" in parsed) return parsed
      } catch {
        /* not JSON — ignore */
      }
      return null
    }

    if (pty) {
      const term = pty.spawn(cmd, args, {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd,
        env: { ...process.env, TERM: "xterm-256color" },
      })

      term.onData((data: string) => sendData(data))
      term.onExit(({ exitCode, signal }) => {
        try {
          ws.close(1000, `exit ${exitCode ?? ""} ${signal ?? ""}`.trim())
        } catch {
          /* ignore */
        }
      })

      ws.on("message", (msg: Buffer | ArrayBuffer | Buffer[]) => {
        const buf = Buffer.isBuffer(msg)
          ? msg
          : Array.isArray(msg)
            ? Buffer.concat(msg)
            : Buffer.from(msg)
        const parsed = parseClientMessage(buf)
        if (parsed?.type === "resize") {
          if (Number.isFinite(parsed.cols) && Number.isFinite(parsed.rows)) {
            term.resize(parsed.cols, parsed.rows)
          }
          return
        }
        if (parsed?.type === "input") {
          term.write(parsed.payload)
          return
        }
        // Unknown envelope — ignore to avoid injecting JSON into the shell.
      })

      ws.on("close", () => {
        try {
          term.kill()
        } catch {
          /* ignore */
        }
      })
      return
    }

    // Fallback: child_process without PTY. Works on Windows without build
    // tools but lacks PTY semantics (no arrow-key history, no echo control).
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: os.platform() === "win32",
    })
    child.stdout?.on("data", (d: Buffer) => sendData(d.toString("utf8")))
    child.stderr?.on("data", (d: Buffer) => sendData(d.toString("utf8")))
    child.on("close", (code) => {
      try {
        ws.close(1000, `exit ${code ?? ""}`.trim())
      } catch {
        /* ignore */
      }
    })
    ws.on("message", (msg: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = Buffer.isBuffer(msg)
        ? msg
        : Array.isArray(msg)
          ? Buffer.concat(msg)
          : Buffer.from(msg)
      const parsed = parseClientMessage(buf)
      if (parsed?.type === "input") {
        child.stdin?.write(parsed.payload)
      }
      // Resize is a no-op without a PTY.
    })
    ws.on("close", () => {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
    })

    sendData(
      "\x1b[33m[charclaw]\x1b[0m local PTY native module (node-pty) not " +
        "available; using basic shell bridge. Arrow keys and history will " +
        "be limited. Install build tools + re-run `npm install` to enable " +
        "full PTY.\r\n",
    )
  })

  const addr = wss.address()
  const port = typeof addr === "object" && addr ? addr.port : 0
  console.log(
    `[terminal] WebSocket listening on 127.0.0.1:${port}${pty ? "" : " (fallback mode — install build tools for PTY)"}`,
  )

  return {
    port,
    stop: () => wss.close(),
  }
}
