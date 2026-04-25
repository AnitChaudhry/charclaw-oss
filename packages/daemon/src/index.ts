#!/usr/bin/env node
/**
 * CharClaw Daemon CLI
 *
 * Usage:
 *   charclaw setup   — register this machine with the server
 *   charclaw start   — start daemon (runs in foreground)
 *   charclaw status  — show runtime status
 *   charclaw agents  — list detected agent CLIs
 */

import { program } from "commander"
import { readConfig, configExists, defaultWorkspaceRoot } from "./config.js"
import { register } from "./register.js"
import { startHeartbeat, setHeartbeatExtras } from "./heartbeat.js"
import { startTerminalServer } from "./terminal-server.js"
import { connectTaskStream } from "./task-stream.js"
import { executeTask } from "./executor.js"
import {
  executeConversationTurn,
  type ConversationTurnTask,
} from "./conversation-handler.js"
import { detectCapabilities } from "./cli-detector.js"

program
  .name("charclaw")
  .description("CharClaw local runtime daemon")
  .version("0.1.0")

// ── setup ─────────────────────────────────────────────────────────────────────
program
  .command("setup")
  .description("Register this machine as a runtime with your CharClaw server")
  .requiredOption("--server <url>", "Server URL (e.g. https://app.charclaw.ai)")
  .requiredOption("--token <token>", "Setup token from Settings → Runtimes in the web app")
  .option("--workspace <path>", "Base directory for git clones", defaultWorkspaceRoot())
  .option("--name <name>", "Display name for this runtime")
  .action(async (opts) => {
    try {
      console.log("Registering with server…")
      const config = await register({
        serverUrl: opts.server,
        setupToken: opts.token,
        workspaceRoot: opts.workspace,
        name: opts.name,
      })
      console.log(`✓ Registered as "${config.name}" (runtimeId: ${config.runtimeId})`)
      console.log(`  Workspace: ${config.workspaceRoot}`)
      console.log(`  Config saved to ~/.charclaw/config.json`)
      console.log("")
      console.log("Start the daemon with: charclaw start")
    } catch (err: unknown) {
      console.error("Setup failed:", err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })

// ── start ─────────────────────────────────────────────────────────────────────
program
  .command("start")
  .description("Start the daemon (blocks; run as a background service)")
  .action(async () => {
    if (!configExists()) {
      console.error("Not configured. Run: charclaw setup --server <url> --token <token>")
      process.exit(1)
    }

    const config = readConfig()
    const caps = await detectCapabilities()

    console.log(`CharClaw Daemon starting…`)
    console.log(`  Server:    ${config.serverUrl}`)
    console.log(`  Runtime:   ${config.name} (${config.runtimeId})`)
    console.log(`  Workspace: ${config.workspaceRoot}`)
    const agentSummary = caps.agents.length
      ? caps.agents
          .map((a) => {
            const v = caps.agentVersions?.[a]
            return v ? `${a}@${v}` : a
          })
          .join(", ")
      : "none detected"
    console.log(`  Agents:    ${agentSummary}`)
    console.log("")

    // Start local terminal WebSocket server (for in-app terminal tab).
    // Resilient to node-pty being missing; degrades to basic shell bridge.
    let stopTerminalServer: () => void = () => {}
    try {
      const term = await startTerminalServer(config)
      stopTerminalServer = term.stop
      setHeartbeatExtras({ terminalWsPort: term.port })
    } catch (err) {
      console.warn(
        "[terminal] WebSocket server failed to start:",
        err instanceof Error ? err.message : err,
      )
      setHeartbeatExtras({ terminalWsPort: null })
    }

    // Start heartbeat
    const stopHeartbeat = startHeartbeat(config)

    // Connect to task stream and dispatch
    const stopStream = connectTaskStream(config, async (task) => {
      // Discriminate on `kind` so we can route conversation turns to a
      // separate handler without touching the branch/repo executor.
      const kind = (task as { kind?: string }).kind
      if (kind === "conversation_turn") {
        const ct = task as unknown as ConversationTurnTask
        console.log(
          `[task] Conversation turn for agent ${ct.agentProfile.slug} ` +
            `(turn ${ct.turnId})`
        )
        try {
          await executeConversationTurn(config, ct)
          console.log(`[task] Completed conversation turn ${ct.turnId}`)
        } catch (err: unknown) {
          console.error(
            `[task] Failed conversation turn ${ct.turnId}:`,
            err instanceof Error ? err.message : err
          )
        }
        return
      }

      const branchTask = task as import("./executor.js").TaskPayload
      console.log(`[task] Received issue ${branchTask.issueId}: "${branchTask.title}"`)
      try {
        await executeTask(config, branchTask)
        console.log(`[task] Completed issue ${branchTask.issueId}`)
      } catch (err: unknown) {
        console.error(`[task] Failed issue ${branchTask.issueId}:`, err instanceof Error ? err.message : err)
      }
    })

    // Graceful shutdown
    const shutdown = () => {
      console.log("\nShutting down daemon…")
      stopHeartbeat()
      stopStream()
      stopTerminalServer()
      process.exit(0)
    }
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    console.log("Daemon running. Press Ctrl+C to stop.")
    // Keep process alive
    await new Promise(() => {})
  })

// ── status ────────────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show this runtime's status on the server")
  .action(async () => {
    if (!configExists()) {
      console.log("Not configured.")
      return
    }
    const config = readConfig()
    try {
      const res = await fetch(
        `${config.serverUrl}/api/runtime/status?runtimeId=${config.runtimeId}`,
        { headers: { Authorization: `Bearer ${config.daemonToken}` } }
      )
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json() as { status: string; lastHeartbeat: string }
      console.log(`Runtime: ${config.name} (${config.runtimeId})`)
      console.log(`Status:  ${data.status}`)
      console.log(`Last heartbeat: ${data.lastHeartbeat ?? "never"}`)
    } catch (err: unknown) {
      console.error("Could not reach server:", err instanceof Error ? err.message : err)
    }
  })

// ── agents ────────────────────────────────────────────────────────────────────
program
  .command("agents")
  .description("List detected AI agent CLIs on this machine")
  .action(async () => {
    const caps = await detectCapabilities()
    if (caps.agents.length === 0) {
      console.log("No agent CLIs detected on PATH.")
      console.log("Install claude, codex, opencode, gemini, goose, or pi to get started.")
    } else {
      console.log("Detected agent CLIs:")
      for (const a of caps.agents) {
        const v = caps.agentVersions?.[a]
        console.log(`  ✓ ${a}${v ? ` (v${v})` : " (version unknown)"}`)
      }
    }
    console.log(`Platform: ${caps.platform}`)
    console.log(`Free disk: ${caps.freeDiskGb}GB`)
  })

program.parse()
