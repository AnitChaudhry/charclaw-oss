/**
 * GET  /api/conversations/[conversationId]/messages  — paged messages
 * POST /api/conversations/[conversationId]/messages  — post user message
 *
 * Posting a user message updates conversation.lastMessageAt and enqueues
 * an agent reply. If the agent's runtime is offline (or there's no
 * runtime at all), we immediately insert a stub assistant message so
 * the UI stays live. Real execution can be wired later.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
  badRequest,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { publishConversationEvent } from "@/lib/chat/conversation-events"
import { pushConversationTurn } from "@/lib/runtime/conversation-dispatch"

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

async function loadAndAuthorize(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      workspaceId: true,
      ownerUserId: true,
      agentProfileId: true,
      archivedAt: true,
    },
  })
  if (!conv) return null
  try {
    await requireWorkspaceAccess(userId, conv.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return { forbidden: resp }
    throw err
  }
  if (conv.ownerUserId !== userId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: conv.workspaceId, userId } },
      select: { role: true },
    })
    if (
      !membership ||
      (membership.role !== "admin" && membership.role !== "owner")
    ) {
      return null
    }
  }
  return { conversation: conv }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const result = await loadAndAuthorize(conversationId, auth.userId)
  if (!result) return notFound()
  if ("forbidden" in result) return result.forbidden

  const url = new URL(req.url)
  const before = url.searchParams.get("before")
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT)
  const limit = Math.min(
    Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw),
    MAX_LIMIT
  )

  let cursor: { createdAt: Date; id: string } | null = null
  if (before) {
    const anchor = await prisma.conversationMessage.findUnique({
      where: { id: before },
      select: { id: true, createdAt: true, conversationId: true },
    })
    if (anchor && anchor.conversationId === conversationId) {
      cursor = { id: anchor.id, createdAt: anchor.createdAt }
    }
  }

  const messages = await prisma.conversationMessage.findMany({
    where: {
      conversationId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              {
                createdAt: cursor.createdAt,
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const hasMore = messages.length > limit
  const page = hasMore ? messages.slice(0, limit) : messages

  return Response.json({
    messages: page.reverse(),
    hasMore,
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const result = await loadAndAuthorize(conversationId, auth.userId)
  if (!result) return notFound()
  if ("forbidden" in result) return result.forbidden
  const conv = result.conversation

  const body = await req.json().catch(() => ({}))
  const { content } = body as { content?: string }
  if (!content?.trim()) return badRequest("content is required")

  // Best-effort mention parsing. The lib may not exist yet.
  let mentions: unknown = null
  try {
    const mod = (await import("@/lib/mentions/parse").catch(() => null)) as
      | {
          parseMentions?: (text: string) => unknown
          resolveMentions?: (parsed: unknown, ctx: unknown) => Promise<unknown>
        }
      | null
    if (mod?.parseMentions) {
      const parsed = mod.parseMentions(content)
      mentions = mod.resolveMentions
        ? await mod.resolveMentions(parsed, {
            workspaceId: conv.workspaceId,
            userId: auth.userId,
          })
        : parsed
    }
  } catch {
    mentions = null
  }

  const now = new Date()
  const userMessage = await prisma.conversationMessage.create({
    data: {
      conversationId,
      role: "user",
      authorUserId: auth.userId,
      content: content.trim(),
      mentions: mentions === null ? undefined : (mentions as never),
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now },
  })

  publishConversationEvent({
    type: "message.created",
    conversationId,
    payload: userMessage,
  })

  // Try to enqueue an agent reply. For now we always insert a stub if
  // the agent is offline — real execution wiring will land in a later
  // change.
  const agentMessage = await tryCreateAgentReply(
    conversationId,
    conv.agentProfileId,
    conv.workspaceId,
    content.trim()
  )

  return Response.json({ userMessage, agentMessage })
}

async function tryCreateAgentReply(
  conversationId: string,
  agentProfileId: string | null,
  workspaceId: string,
  userPrompt: string
) {
  if (!agentProfileId) return null

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      model: true,
      workspaceId: true,
      runtimeId: true,
      runtime: { select: { id: true, status: true } },
    },
  })
  if (!agent || agent.workspaceId !== workspaceId) return null

  const online =
    !!agent.runtime &&
    (agent.runtime.status === "online" || agent.runtime.status === "active")

  if (online && agent.runtime) {
    // Create an empty assistant placeholder, then push the task so the
    // daemon can POST progress deltas into that row via
    // /api/runtime/conversation-progress.
    const placeholder = await prisma.conversationMessage.create({
      data: {
        conversationId,
        role: "assistant",
        authorAgentSlug: agent.slug,
        content: "",
        contentBlocks: { status: "streaming" },
      },
    })

    const priorMessages = await prisma.conversationMessage.findMany({
      where: {
        conversationId,
        id: { not: placeholder.id },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 20,
      select: { role: true, content: true },
    })

    const dispatched = pushConversationTurn(agent.runtime.id, {
      kind: "conversation_turn",
      turnId: placeholder.id,
      conversationId,
      workspaceId,
      agentProfile: {
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        kind: agent.kind,
        model: agent.model,
      },
      priorMessages: priorMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system" | "tool",
        content: m.content,
      })),
      userPrompt,
    })

    if (!dispatched) {
      // Daemon wasn't actually subscribed even though status says online —
      // mark the placeholder as failed so the UI is honest.
      const updated = await prisma.conversationMessage.update({
        where: { id: placeholder.id },
        data: {
          content: "[error] daemon not reachable",
          contentBlocks: { status: "failed", error: "daemon not reachable" },
        },
      })
      publishConversationEvent({
        type: "message.updated",
        conversationId,
        payload: updated,
      })
      return updated
    }

    publishConversationEvent({
      type: "message.created",
      conversationId,
      payload: placeholder,
    })
    return placeholder
  }

  // Offline path — insert a labeled stub so the UI stays live.
  const stub = await prisma.conversationMessage.create({
    data: {
      conversationId,
      role: "assistant",
      authorAgentSlug: agent.slug,
      content: "(agent offline — stub reply)",
      contentBlocks: { status: "offline_stub" },
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: stub.createdAt },
  })

  publishConversationEvent({
    type: "message.created",
    conversationId,
    payload: stub,
  })

  return stub
}
