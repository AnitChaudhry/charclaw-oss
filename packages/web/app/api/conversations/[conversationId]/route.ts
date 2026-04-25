/**
 * GET    /api/conversations/[conversationId]  — conversation + last 50 messages
 * PATCH  /api/conversations/[conversationId]  — update title / archivedAt
 * DELETE /api/conversations/[conversationId]  — hard delete
 *
 * Access: caller must be conversation.ownerUserId OR a workspace admin.
 * Workspace membership is always required via requireWorkspaceAccess.
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

const AGENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
  kind: true,
} as const

async function loadAndAuthorize(
  conversationId: string,
  userId: string
): Promise<
  | { kind: "ok"; conversation: NonNullable<Awaited<ReturnType<typeof findConversation>>> }
  | { kind: "response"; response: Response }
> {
  const conv = await findConversation(conversationId)
  if (!conv) return { kind: "response", response: notFound() }

  try {
    await requireWorkspaceAccess(userId, conv.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return { kind: "response", response: resp }
    throw err
  }

  if (conv.ownerUserId !== userId) {
    // Workspace admins may still view/manage.
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: conv.workspaceId, userId },
      },
      select: { role: true },
    })
    if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
      return { kind: "response", response: notFound() }
    }
  }

  return { kind: "ok", conversation: conv }
}

function findConversation(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      workspaceId: true,
      ownerUserId: true,
      agentProfileId: true,
      title: true,
      archivedAt: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const result = await loadAndAuthorize(conversationId, auth.userId)
  if (result.kind === "response") return result.response
  const conv = result.conversation

  const [agent, messages] = await Promise.all([
    conv.agentProfileId
      ? prisma.agentProfile.findUnique({
          where: { id: conv.agentProfileId },
          select: AGENT_SELECT,
        })
      : Promise.resolve(null),
    prisma.conversationMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  return Response.json({
    conversation: { ...conv, agentProfile: agent ?? null },
    // Return oldest-first for UI convenience.
    messages: messages.reverse(),
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const result = await loadAndAuthorize(conversationId, auth.userId)
  if (result.kind === "response") return result.response

  const body = await req.json().catch(() => ({}))
  const { title, archivedAt } = body as {
    title?: string | null
    archivedAt?: string | null
  }

  const data: { title?: string | null; archivedAt?: Date | null } = {}
  if (title !== undefined) {
    if (title === null) data.title = null
    else if (typeof title !== "string") return badRequest("title must be a string or null")
    else data.title = title.trim() || null
  }
  if (archivedAt !== undefined) {
    if (archivedAt === null) data.archivedAt = null
    else {
      const parsed = new Date(archivedAt)
      if (isNaN(parsed.getTime())) return badRequest("archivedAt must be a valid ISO date")
      data.archivedAt = parsed
    }
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data,
    select: {
      id: true,
      title: true,
      agentProfileId: true,
      lastMessageAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ conversation: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { conversationId } = await params

  const result = await loadAndAuthorize(conversationId, auth.userId)
  if (result.kind === "response") return result.response

  await prisma.conversation.delete({ where: { id: conversationId } })
  return Response.json({ ok: true })
}
