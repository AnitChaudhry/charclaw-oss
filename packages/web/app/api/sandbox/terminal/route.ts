import { createHmac } from "node:crypto"
import { prisma } from "@/lib/db/prisma"
import { ensureDaytonaStarted } from "@/lib/sandbox/sandbox-resume"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
  getDaytonaApiKey,
  isDaytonaKeyError,
  internalError,
} from "@/lib/shared/api-helpers"
import {
  setupTerminal,
  stopTerminal,
  getTerminalStatus,
} from "@charclaw/terminal"

// Must stay in sync with signTerminalToken() in packages/daemon/src/terminal-server.ts.
function signTerminalToken(
  daemonToken: string,
  sandboxId: string,
  expiresAt: number,
): string {
  return createHmac("sha256", daemonToken)
    .update(`${sandboxId}.${expiresAt}`)
    .digest("hex")
}

// Timeout for terminal setup - 60 seconds
export const maxDuration = 60

/**
 * POST /api/sandbox/terminal
 *
 * Sets up a WebSocket PTY terminal server in the sandbox.
 * Returns the WebSocket URL for connecting from the browser.
 *
 * Request body:
 *   - sandboxId: string - The sandbox ID
 *   - action: "setup" | "status" | "stop"
 *
 * Response:
 *   - websocketUrl: string - The WebSocket URL to connect to
 *   - httpsUrl: string - The HTTPS URL for health checks
 *   - status: "running" | "starting" | "stopped" | "error"
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  let body: {
    sandboxId?: string
    action?: "setup" | "status" | "stop"
  }

  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid or empty JSON body")
  }

  const { sandboxId, action = "setup" } = body

  if (!sandboxId) {
    return badRequest("Missing sandboxId")
  }

  console.log(`[terminal] action=${action} sandboxId=${sandboxId}`)

  // Verify ownership + pull runtime info so we can branch on kind
  const sandboxRecord = await prisma.sandbox.findUnique({
    where: { sandboxId },
    include: {
      runtime: {
        select: {
          kind: true,
          status: true,
          workspaceRoot: true,
          capabilities: true,
          daemonToken: true,
        },
      },
      branch: {
        select: {
          name: true,
          repo: { select: { owner: true, name: true } },
        },
      },
    },
  })

  if (!sandboxRecord || sandboxRecord.userId !== auth.userId) {
    return notFound("Sandbox not found")
  }

  // Local runtime: hand the browser a signed WS URL pointing at the daemon's
  // local terminal server. Daemon advertises its ephemeral port via the
  // heartbeat capabilities payload.
  if (sandboxRecord.runtime?.kind === "local") {
    const ws = sandboxRecord.runtime.workspaceRoot ?? ""
    const owner = sandboxRecord.branch?.repo.owner ?? ""
    const repo = sandboxRecord.branch?.repo.name ?? ""
    const branchDir = sandboxRecord.branch?.name.replace(/\//g, "--") ?? ""
    const cwd = [ws, owner, repo, branchDir].filter(Boolean).join("/")

    if (action === "stop") {
      // Terminal sessions are per-WebSocket; closing the socket kills the PTY.
      return Response.json({ status: "stopped", runtimeKind: "local" })
    }

    const caps = (sandboxRecord.runtime.capabilities ?? {}) as {
      terminalWsPort?: number | null
    }
    const port = typeof caps.terminalWsPort === "number" ? caps.terminalWsPort : null
    const daemonToken = sandboxRecord.runtime.daemonToken

    if (!port || !daemonToken || sandboxRecord.runtime.status !== "online") {
      return Response.json({
        status: "unsupported",
        runtimeKind: "local",
        cwd,
        message:
          sandboxRecord.runtime.status !== "online"
            ? "Your local daemon is offline. Start it with `charclaw start` to enable the in-app terminal."
            : "Your local daemon is running an older build without terminal support. Pull the latest and re-run `npm install` + `charclaw start`.",
      })
    }

    const expiresAt = Date.now() + 60_000 // 60s window to open the socket
    const token = signTerminalToken(daemonToken, sandboxId, expiresAt)
    const params = new URLSearchParams({
      sandboxId,
      expiresAt: String(expiresAt),
      token,
      cwd,
    })
    const websocketUrl = `ws://127.0.0.1:${port}/term?${params.toString()}`

    return Response.json({
      status: "running",
      runtimeKind: "local",
      cwd,
      websocketUrl,
    })
  }

  const daytonaApiKey = getDaytonaApiKey()
  if (isDaytonaKeyError(daytonaApiKey)) return daytonaApiKey

  try {
    const sandbox = await ensureDaytonaStarted(daytonaApiKey, sandboxId)
    if (!sandbox) return notFound()

    switch (action) {
      case "status": {
        const result = await getTerminalStatus(sandbox)
        return Response.json(result)
      }

      case "stop": {
        const result = await stopTerminal(sandbox)
        return Response.json(result)
      }

      case "setup":
      default: {
        const result = await setupTerminal(sandbox)
        if (result.status === "error") {
          return Response.json(result, { status: 500 })
        }
        return Response.json(result)
      }
    }
  } catch (error: unknown) {
    console.error("[terminal] Error:", error)
    return internalError(error)
  }
}
