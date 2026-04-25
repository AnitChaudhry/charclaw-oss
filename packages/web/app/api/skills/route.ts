/**
 * GET  /api/skills  — list skills for the current user (workspace-scoped)
 * POST /api/skills/search — keyword search (separate file)
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  const tag = url.searchParams.get("tag") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 100)

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

  const skills = await prisma.skill.findMany({
    where: {
      userId: auth.userId,
      ...(workspaceId ? { workspaceId } : {}),
      ...(tag && { tags: { has: tag } }),
    },
    orderBy: [{ useCount: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true, title: true, description: true, tags: true,
      useCount: true, createdAt: true, sourceSessionId: true,
    },
  })

  return Response.json({ skills })
}
