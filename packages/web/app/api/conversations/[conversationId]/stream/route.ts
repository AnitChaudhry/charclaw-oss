/**
 * GET /api/conversations/[conversationId]/stream
 *
 * Server-Sent Events endpoint for live ConversationMessage updates.
 * Uses the in-process EventEmitter from `lib/chat/conversation-events`.
 * Sends a heartbeat comment every 15s so proxies don't close the
 * stream. The client should use EventSource and listen for the default
 * `message` events. Each payload is a JSON object: `{ type, payload }`.
 */

import {
  requireAuth,
  isAuthError,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { prisma } from "@/lib/db/prisma"
import {
  subscribeConversationEvents,
  type ConversationEvent,
} from "@/lib/chat/conversation-events"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, workspaceId: true, ownerUserId: true },
  })
  if (!conv) return notFound()
  try {
    await requireWorkspaceAccess(auth.userId, conv.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }
  if (conv.ownerUserId !== auth.userId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: conv.workspaceId, userId: auth.userId },
      },
      select: { role: true },
    })
    if (
      !membership ||
      (membership.role !== "admin" && membership.role !== "owner")
    ) {
      return notFound()
    }
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ConversationEvent) => {
        try {
          const line = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(line))
        } catch {
          // Stream closed; cleanup happens in cancel().
        }
      }

      // Initial comment so clients know the stream is live.
      controller.enqueue(encoder.encode(`: connected\n\n`))

      unsubscribe = subscribeConversationEvents(conversationId, send)

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // ignore
        }
      }, 15000)
    },
    cancel() {
      if (unsubscribe) unsubscribe()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
