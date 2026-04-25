/**
 * SSE client — connects to server and receives task assignments in real time.
 * Reconnects automatically on drop.
 */

import type { DaemonConfig } from "./config.js"
import type { TaskPayload } from "./executor.js"
import type { ConversationTurnTask } from "./conversation-handler.js"

// Tasks are discriminated by an optional `kind` field. Branch tasks
// (the original shape) have no `kind`; conversation turns carry
// `kind: "conversation_turn"`. Handler parses the union and dispatches.
export type AnyTask = TaskPayload | ConversationTurnTask
type TaskHandler = (task: AnyTask) => void

export function connectTaskStream(config: DaemonConfig, onTask: TaskHandler): () => void {
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async function connect() {
    if (stopped) return

    const url = `${config.serverUrl}/api/runtime/tasks?runtimeId=${config.runtimeId}`
    console.log(`[task-stream] Connecting to ${url}`)

    try {
      // Omit `signal` entirely — AbortSignal.timeout(0) actually aborts
      // immediately per spec, which is the opposite of what we want.
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.daemonToken}` },
      })

      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (!stopped) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim()
            if (!raw || raw === "ping") continue
            try {
              const task = JSON.parse(raw) as AnyTask
              onTask(task)
            } catch (err) {
              console.warn("[task-stream] Could not parse SSE data:", raw.slice(0, 100))
            }
          }
        }
      }
    } catch (err: unknown) {
      if (!stopped) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[task-stream] Disconnected: ${msg}. Reconnecting in 5s…`)
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    if (!stopped) {
      console.log("[task-stream] Stream ended. Reconnecting in 5s…")
      reconnectTimer = setTimeout(connect, 5000)
    }
  }

  connect()

  return () => {
    stopped = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
}
