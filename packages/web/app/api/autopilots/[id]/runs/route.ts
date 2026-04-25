/**
 * GET /api/autopilots/[id]/runs?limit=50  — list runs for an autopilot,
 * newest first. Workspace-guarded.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { id } = await params

  const autopilot = await prisma.autopilot.findUnique({ where: { id } })
  if (!autopilot) return notFound()

  try {
    await requireWorkspaceAccess(auth.userId, autopilot.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  const url = new URL(req.url)
  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(200, Math.floor(limitParam)) : 50

  const runs = await prisma.autopilotRun.findMany({
    where: { autopilotId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
  })

  return Response.json({ runs })
}
