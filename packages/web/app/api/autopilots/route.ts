/**
 * GET  /api/autopilots  — list autopilots in the active workspace
 * POST /api/autopilots  — create a new autopilot
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  internalError,
} from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { nextRunAfter } from "@/lib/autopilots/cron"

const VALID_TRIGGERS = ["cron", "manual", "webhook", "on_pr_open"] as const

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

  if (!workspaceId) return Response.json({ autopilots: [] })

  const autopilots = await prisma.autopilot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  return Response.json({ autopilots })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return badRequest("name is required")

  const trigger =
    typeof body.trigger === "string" ? body.trigger : "cron"
  if (!VALID_TRIGGERS.includes(trigger as (typeof VALID_TRIGGERS)[number])) {
    return badRequest(
      `trigger must be one of: ${VALID_TRIGGERS.join(", ")}`
    )
  }

  const schedule =
    typeof body.schedule === "string" && body.schedule.trim()
      ? body.schedule.trim()
      : null
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : "UTC"

  if (trigger === "cron" && !schedule) {
    return badRequest("schedule is required when trigger=cron")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = (body.config ?? {}) as any
  if (!config || typeof config !== "object") {
    return badRequest("config must be an object")
  }
  if (typeof config.titleTemplate !== "string" || !config.titleTemplate.trim()) {
    return badRequest("config.titleTemplate is required")
  }
  if (typeof config.bodyTemplate !== "string") {
    return badRequest("config.bodyTemplate must be a string")
  }

  let workspaceId: string
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId:
        typeof body.workspaceId === "string" ? body.workspaceId : null,
      workspaceSlug:
        typeof body.workspaceSlug === "string" ? body.workspaceSlug : null,
    })
    if (!ws) return badRequest("No active workspace — create one first")
    workspaceId = ws.id
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  let nextRunAt: Date | null = null
  if (trigger === "cron" && schedule) {
    try {
      nextRunAt = nextRunAfter(schedule, new Date(), timezone)
    } catch (err) {
      return badRequest(
        `Invalid cron schedule: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  try {
    const autopilot = await prisma.autopilot.create({
      data: {
        workspaceId,
        name,
        description:
          typeof body.description === "string" ? body.description : null,
        enabled: true,
        trigger,
        schedule,
        timezone,
        agentProfileId:
          typeof body.agentProfileId === "string" ? body.agentProfileId : null,
        repoId:
          typeof body.repoId === "string" ? body.repoId : null,
        config,
        nextRunAt,
        createdByUserId: auth.userId,
      },
    })
    return Response.json({ autopilot }, { status: 201 })
  } catch (err) {
    return internalError(err)
  }
}
