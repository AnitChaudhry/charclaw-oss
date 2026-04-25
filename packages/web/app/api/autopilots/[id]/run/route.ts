/**
 * POST /api/autopilots/[id]/run  — manually fire an autopilot.
 *
 * Creates an AutopilotRun, attempts to create an Issue using the autopilot's
 * templates, updates the run + autopilot lastRunAt/nextRunAt, then returns
 * the run row.
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
import { fireAutopilot } from "@/lib/autopilots/fire"

export async function POST(
  _req: Request,
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

  const result = await fireAutopilot(id)
  const run = result.runId
    ? await prisma.autopilotRun.findUnique({ where: { id: result.runId } })
    : null
  const refreshed = await prisma.autopilot.findUnique({ where: { id } })

  return Response.json(
    { result, run, autopilot: refreshed },
    { status: result.status === "failed" ? 500 : 200 }
  )
}
