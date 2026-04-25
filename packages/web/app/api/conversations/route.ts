/**
 * GET  /api/conversations  — list caller's conversations in the active workspace
 * POST /api/conversations  — create a new 1:1 conversation with an AgentProfile
 *
 * Chat-with-Agent surface. Completely independent of branch chat /
 * issue comments. Every query filters by workspaceId via
 * requireWorkspaceAccess.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

const AGENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
  kind: true,
} as const

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  let workspaceId: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: url.searchParams.get("workspaceId"),
      workspaceSlug: url.searchParams.get("workspaceSlug"),
    })
    workspaceId = ws?.id ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  if (!workspaceId) {
    return Response.json({ conversations: [] })
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      workspaceId,
      ownerUserId: auth.userId,
    },
    orderBy: [
      { lastMessageAt: "desc" },
      { createdAt: "desc" },
    ],
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

  // Hydrate agent profile in a second query to keep the select tight.
  const agentIds = Array.from(
    new Set(
      conversations
        .map((c) => c.agentProfileId)
        .filter((id): id is string => !!id)
    )
  )
  const agents = agentIds.length
    ? await prisma.agentProfile.findMany({
        where: { id: { in: agentIds } },
        select: AGENT_SELECT,
      })
    : []
  const agentById = new Map(agents.map((a) => [a.id, a]))

  const enriched = conversations.map((c) => ({
    ...c,
    agentProfile: c.agentProfileId
      ? agentById.get(c.agentProfileId) ?? null
      : null,
  }))

  return Response.json({ conversations: enriched })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const {
    agentProfileId,
    title,
    workspaceId: bodyWorkspaceId,
    workspaceSlug,
  } = body as {
    agentProfileId?: string
    title?: string
    workspaceId?: string
    workspaceSlug?: string
  }

  if (!agentProfileId) return badRequest("agentProfileId is required")

  let workspaceId: string
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: bodyWorkspaceId,
      workspaceSlug,
    })
    if (!ws) return badRequest("No active workspace — create one first")
    workspaceId = ws.id
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  // Validate agent belongs to the same workspace.
  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: { ...AGENT_SELECT, workspaceId: true },
  })
  if (!agent || agent.workspaceId !== workspaceId) {
    return badRequest("Agent not found in this workspace")
  }

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      ownerUserId: auth.userId,
      agentProfileId,
      title: title?.trim() || null,
    },
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

  return Response.json(
    {
      conversation: {
        ...conversation,
        agentProfile: {
          id: agent.id,
          slug: agent.slug,
          name: agent.name,
          avatarUrl: agent.avatarUrl,
          kind: agent.kind,
        },
      },
    },
    { status: 201 }
  )
}
