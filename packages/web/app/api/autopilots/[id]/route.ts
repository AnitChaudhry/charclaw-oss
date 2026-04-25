/**
 * GET    /api/autopilots/[id]  — fetch autopilot (workspace-guarded)
 * PATCH  /api/autopilots/[id]  — update fields (recomputes nextRunAt when schedule changes)
 * DELETE /api/autopilots/[id]  — remove autopilot + cascade runs
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
  internalError,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { nextRunAfter } from "@/lib/autopilots/cron"

async function loadAutopilotWithGuard(id: string, userId: string) {
  const autopilot = await prisma.autopilot.findUnique({ where: { id } })
  if (!autopilot) return { autopilot: null, guardResponse: notFound() }
  try {
    await requireWorkspaceAccess(userId, autopilot.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return { autopilot: null, guardResponse: resp }
    throw err
  }
  return { autopilot, guardResponse: null }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { id } = await params

  const { autopilot, guardResponse } = await loadAutopilotWithGuard(
    id,
    auth.userId
  )
  if (guardResponse) return guardResponse
  return Response.json({ autopilot })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { id } = await params

  const { autopilot, guardResponse } = await loadAutopilotWithGuard(
    id,
    auth.userId
  )
  if (guardResponse) return guardResponse
  if (!autopilot) return notFound()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if (typeof body.name === "string") data.name = body.name.trim()
  if (body.description === null || typeof body.description === "string") {
    data.description = body.description as string | null
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (typeof body.trigger === "string") data.trigger = body.trigger
  if (
    body.schedule === null ||
    typeof body.schedule === "string"
  ) {
    data.schedule = body.schedule as string | null
  }
  if (typeof body.timezone === "string") data.timezone = body.timezone
  if (body.agentProfileId === null || typeof body.agentProfileId === "string") {
    data.agentProfileId = body.agentProfileId as string | null
  }
  if (body.repoId === null || typeof body.repoId === "string") {
    data.repoId = body.repoId as string | null
  }
  if (body.config !== undefined) data.config = body.config

  // If schedule or timezone changed, recompute nextRunAt.
  const newSchedule =
    data.schedule !== undefined ? data.schedule : autopilot.schedule
  const newTimezone =
    data.timezone !== undefined ? data.timezone : autopilot.timezone
  const newTrigger =
    data.trigger !== undefined ? data.trigger : autopilot.trigger

  const scheduleChanged =
    data.schedule !== undefined ||
    data.timezone !== undefined ||
    data.trigger !== undefined

  if (scheduleChanged) {
    if (newTrigger === "cron" && newSchedule) {
      try {
        data.nextRunAt = nextRunAfter(newSchedule, new Date(), newTimezone || "UTC")
      } catch (err) {
        return badRequest(
          `Invalid cron schedule: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    } else {
      data.nextRunAt = null
    }
  }

  try {
    const updated = await prisma.autopilot.update({
      where: { id },
      data,
    })
    return Response.json({ autopilot: updated })
  } catch (err) {
    return internalError(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { id } = await params

  const { autopilot, guardResponse } = await loadAutopilotWithGuard(
    id,
    auth.userId
  )
  if (guardResponse) return guardResponse
  if (!autopilot) return notFound()

  await prisma.autopilot.delete({ where: { id } })
  return Response.json({ ok: true })
}
