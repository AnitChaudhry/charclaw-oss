/**
 * POST /api/skills/search
 * Full-text keyword search across title, description, and tags (workspace-scoped).
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { query, workspaceId: bodyWorkspaceId, workspaceSlug } = body
  if (!query?.trim()) return badRequest("query is required")

  const q = query.trim().toLowerCase()

  let workspaceId: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: bodyWorkspaceId,
      workspaceSlug,
    })
    workspaceId = ws?.id ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  const skills = await prisma.skill.findMany({
    where: {
      userId: auth.userId,
      ...(workspaceId ? { workspaceId } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ],
    },
    orderBy: [{ useCount: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: {
      id: true, title: true, description: true, tags: true,
      useCount: true, steps: true,
    },
  })

  return Response.json({ skills })
}
