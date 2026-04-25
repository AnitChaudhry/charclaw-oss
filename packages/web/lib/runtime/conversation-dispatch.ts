/**
 * Push a conversation-turn task to the daemon SSE stream.
 *
 * Reuses the existing `pushTaskToRuntime` mechanism (`/api/runtime/tasks`)
 * but shapes the payload as `kind: "conversation_turn"` so the daemon's
 * dispatcher routes it to the conversation handler instead of the
 * branch/repo executor.
 */

import { pushTaskToRuntime } from "@/lib/runtime/task-broadcast"

export interface ConversationTurnTask {
  kind: "conversation_turn"
  turnId: string // placeholder message id; used to dedup + tag progress posts
  conversationId: string
  workspaceId: string
  agentProfile: {
    id: string
    slug: string
    name: string
    kind: string // "claude-code" | "codex" | etc.
    model?: string | null
  }
  priorMessages: Array<{
    role: "user" | "assistant" | "system" | "tool"
    content: string
  }>
  userPrompt: string
}

export function pushConversationTurn(
  runtimeId: string,
  task: ConversationTurnTask
): boolean {
  return pushTaskToRuntime(runtimeId, task)
}
