/**
 * Handles `conversation_turn` tasks from the SSE task stream: runs the
 * configured agent CLI with a composed prompt and streams stdout back
 * to the server as progress deltas.
 *
 * Kept intentionally minimal — no git, no sandbox workspace. A temp
 * working directory is used so the CLI has somewhere to scratch if it
 * wants to.
 */

import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { DaemonConfig } from "./config.js"

export interface ConversationTurnTask {
  kind: "conversation_turn"
  turnId: string
  conversationId: string
  workspaceId: string
  agentProfile: {
    id: string
    slug: string
    name: string
    kind: string
    model?: string | null
  }
  priorMessages: Array<{
    role: "user" | "assistant" | "system" | "tool"
    content: string
  }>
  userPrompt: string
}

const DEBOUNCE_MS = 200
const DEBOUNCE_CHARS = 60

/** Map agent kind (e.g. "claude-code") to an executable on PATH. */
function resolveCli(kind: string): { cmd: string; args: (prompt: string) => string[] } | null {
  switch (kind) {
    case "claude-code":
    case "claude":
      // claude accepts a non-interactive one-shot via --print
      return { cmd: "claude", args: (p) => ["--print", p] }
    case "codex":
      return { cmd: "codex", args: (p) => ["--quiet", p] }
    case "gemini":
      return { cmd: "gemini", args: (p) => ["--prompt", p] }
    case "goose":
      return { cmd: "goose", args: (p) => ["run", p] }
    case "opencode":
      return { cmd: "opencode", args: (p) => ["--prompt", p] }
    case "pi":
      return { cmd: "pi", args: (p) => ["--prompt", p] }
    default:
      return null
  }
}

function composePrompt(task: ConversationTurnTask): string {
  const lines: string[] = []
  if (task.priorMessages.length > 0) {
    lines.push("# Conversation so far")
    for (const m of task.priorMessages) {
      lines.push(`## ${m.role}`)
      lines.push(m.content)
    }
    lines.push("")
  }
  lines.push("# New message from user")
  lines.push(task.userPrompt)
  lines.push("")
  lines.push("Respond to the user directly. Do not clone or modify any repository.")
  return lines.join("\n")
}

async function postProgress(
  config: DaemonConfig,
  conversationId: string,
  turnId: string,
  body: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${config.serverUrl}/api/runtime/conversation-progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.daemonToken}`,
      },
      body: JSON.stringify({ turnId, conversationId, ...body }),
    })
  } catch (err) {
    console.error("[conversation-handler] Failed to post progress:", err)
  }
}

export async function executeConversationTurn(
  config: DaemonConfig,
  task: ConversationTurnTask
): Promise<void> {
  const cli = resolveCli(task.agentProfile.kind)
  if (!cli) {
    await postProgress(config, task.conversationId, task.turnId, {
      kind: "failed",
      error: `Unsupported agent kind: ${task.agentProfile.kind}`,
    })
    return
  }

  const prompt = composePrompt(task)
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "charclaw-chat-"))

  let pending = ""
  let lastFlush = Date.now()
  let accumulated = ""

  async function flush(force = false) {
    const now = Date.now()
    const shouldFlush =
      force ||
      pending.length >= DEBOUNCE_CHARS ||
      now - lastFlush >= DEBOUNCE_MS
    if (!shouldFlush || pending.length === 0) return
    const delta = pending
    pending = ""
    lastFlush = now
    await postProgress(config, task.conversationId, task.turnId, {
      kind: "delta",
      textDelta: delta,
    })
  }

  return new Promise<void>((resolve) => {
    // Node on Windows requires shell:true to resolve .cmd/.bat wrappers
    // (CVE-2024-27980 hardening). On POSIX it also works fine.
    const child = spawn(cli.cmd, cli.args(prompt), {
      cwd: workdir,
      env: {
        ...process.env,
        // agent-specific envs can be layered here later
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    })

    const flushTimer = setInterval(() => {
      void flush(false)
    }, DEBOUNCE_MS)

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8")
      accumulated += text
      pending += text
      if (pending.length >= DEBOUNCE_CHARS) void flush(false)
    })

    child.stderr.on("data", (chunk: Buffer) => {
      // Merge stderr into accumulated so users see errors; tag with prefix.
      const text = chunk.toString("utf8")
      accumulated += text
      pending += text
    })

    child.on("error", async (err) => {
      clearInterval(flushTimer)
      await flush(true)
      await postProgress(config, task.conversationId, task.turnId, {
        kind: "failed",
        error: err.message || String(err),
      })
      cleanupWorkdir(workdir)
      resolve()
    })

    child.on("close", async (code) => {
      clearInterval(flushTimer)
      await flush(true)
      if (code === 0) {
        await postProgress(config, task.conversationId, task.turnId, {
          kind: "completed",
          finalContent: accumulated,
        })
      } else {
        await postProgress(config, task.conversationId, task.turnId, {
          kind: "failed",
          error: `${cli.cmd} exited with code ${code ?? "null"}`,
        })
      }
      cleanupWorkdir(workdir)
      resolve()
    })
  })
}

function cleanupWorkdir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}
