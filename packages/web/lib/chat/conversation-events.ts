/**
 * In-process event emitter for live Conversation message updates.
 *
 * Keyed by conversationId. The SSE endpoint in
 * `app/api/conversations/[conversationId]/stream/route.ts` subscribes;
 * the POST message route publishes. This is process-local (no Redis /
 * pubsub), which is fine for a single-node dev deployment — a future
 * phase will swap this for a distributed bus.
 */

import { EventEmitter } from "events"

export type ConversationEventType =
  | "message.created"
  | "message.updated"
  | "conversation.updated"

export interface ConversationEvent {
  type: ConversationEventType
  conversationId: string
  // payload varies by event type; keep it opaque at this layer
  payload: unknown
}

// Use a module-level singleton. Next.js hot reload may re-execute this
// module, but that's fine — subscribers re-attach on each connection.
type GlobalWithEmitter = typeof globalThis & {
  __upfynConversationEmitter?: EventEmitter
}
const g = globalThis as GlobalWithEmitter
const emitter: EventEmitter =
  g.__upfynConversationEmitter ?? new EventEmitter()
emitter.setMaxListeners(0) // allow many SSE connections
g.__upfynConversationEmitter = emitter

function channel(conversationId: string): string {
  return `conv:${conversationId}`
}

export function publishConversationEvent(event: ConversationEvent): void {
  emitter.emit(channel(event.conversationId), event)
}

export function subscribeConversationEvents(
  conversationId: string,
  handler: (event: ConversationEvent) => void
): () => void {
  const ch = channel(conversationId)
  emitter.on(ch, handler)
  return () => {
    emitter.off(ch, handler)
  }
}
