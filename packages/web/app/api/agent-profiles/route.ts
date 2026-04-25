/**
 * GET  /api/agent-profiles  — list agent profiles for the current user (workspace-scoped)
 * POST /api/agent-profiles  — create a new agent profile in the active workspace
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

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

  const profiles = await prisma.agentProfile.findMany({
    where: {
      userId: auth.userId,
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      model: true,
      avatarUrl: true,
      bio: true,
      runtimeId: true,
      defaultRepoId: true,
      workspaceId: true,
      createdAt: true,
    },
  })

  return Response.json({ profiles })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const {
    name,
    slug,
    kind,
    model,
    avatarUrl,
    bio,
    runtimeId,
    defaultRepoId,
    workspaceId: bodyWorkspaceId,
    workspaceSlug,
  } = body

  if (!name?.trim()) return badRequest("name is required")
  if (!slug?.trim()) return badRequest("slug is required")
  if (!/^[a-z0-9-]+$/.test(slug)) return badRequest("slug must be lowercase alphanumeric with hyphens")

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

  const existing = await prisma.agentProfile.findUnique({
    where: { userId_slug: { userId: auth.userId, slug } },
  })
  if (existing) return badRequest("Slug already in use")

  const profile = await prisma.agentProfile.create({
    data: {
      userId: auth.userId,
      workspaceId,
      name: name.trim(),
      slug,
      kind: kind ?? "claude-code",
      model: model ?? null,
      avatarUrl: avatarUrl ?? null,
      bio: bio ?? null,
      runtimeId: runtimeId ?? null,
      defaultRepoId: defaultRepoId ?? null,
    },
  })

  return Response.json({ profile }, { status: 201 })
}
