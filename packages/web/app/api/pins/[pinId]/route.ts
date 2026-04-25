/**
 * PATCH  /api/pins/[pinId]  — update label, icon, filter, or position.
 * DELETE /api/pins/[pinId]  — remove a pin.
 *
 * Kind and targetRef are immutable — to change the "pointed-at" thing,
 * delete and recreate. That keeps the validation surface small and
 * avoids stale slug/href mismatches.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { resolveHref } from "@/lib/pins/resolveHref"
import type { IssueFilter } from "@/lib/types/pin"

function sanitizeFilter(raw: unknown): IssueFilter | null {
  if (raw == null || typeof raw !== "object") return null
  const f = raw as Record<string, unknown>
  const out: IssueFilter = {}
  if (typeof f.status === "string") out.status = f.status
  if (typeof f.assigneeAgentId === "string") out.assigneeAgentId = f.assigneeAgentId
  if (typeof f.projectId === "string") out.projectId = f.projectId
  if (typeof f.q === "string") out.q = f.q
  if (Array.isArray(f.tags)) {
    out.tags = f.tags.filter((t): t is string => typeof t === "string")
  }
  return out
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { pinId } = await params

  const pin = await prisma.pin.findUnique({ where: { id: pinId } })
  if (!pin || pin.userId !== auth.userId) return notFound()

  try {
    await requireWorkspaceAccess(auth.userId, pin.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return badRequest("Invalid JSON body")
  }

  const data: Prisma.PinUpdateInput = {}

  if (body.label !== undefined) {
    if (typeof body.label !== "string" || !body.label.trim()) {
      return badRequest("label must be a non-empty string")
    }
    data.label = body.label.trim()
  }
  if (body.icon !== undefined) {
    if (body.icon !== null && typeof body.icon !== "string") {
      return badRequest("icon must be string or null")
    }
    data.icon = body.icon as string | null
  }
  if (body.filter !== undefined) {
    if (pin.kind !== "issue_filter") {
      return badRequest("filter can only be updated on issue_filter pins")
    }
    const sanitized = sanitizeFilter(body.filter)
    data.filter = (sanitized ?? {}) as Prisma.InputJsonValue
  }
  if (body.position !== undefined) {
    if (typeof body.position !== "number" || !Number.isFinite(body.position)) {
      return badRequest("position must be a number")
    }
    data.position = Math.trunc(body.position)
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: pin.workspaceId },
    select: { slug: true },
  })
  if (!workspace) return notFound("Workspace not found")

  const updated = await prisma.pin.update({
    where: { id: pinId },
    data,
    select: {
      id: true,
      kind: true,
      label: true,
      icon: true,
      targetRef: true,
      filter: true,
      position: true,
    },
  })

  // Re-resolve slug for project pins so the returned `href` is correct.
  let targetSlug: string | null = null
  if (updated.kind === "project" && updated.targetRef) {
    const project = await prisma.project.findFirst({
      where: { id: updated.targetRef, workspaceId: pin.workspaceId },
      select: { slug: true },
    })
    targetSlug = project?.slug ?? null
  }

  const filter = sanitizeFilter(updated.filter)
  return Response.json({
    pin: {
      id: updated.id,
      kind: updated.kind,
      label: updated.label,
      icon: updated.icon,
      targetRef: updated.targetRef,
      filter,
      position: updated.position,
      targetSlug,
      href: resolveHref(
        {
          kind: updated.kind,
          targetRef: updated.targetRef,
          targetSlug,
          filter,
        },
        workspace.slug
      ),
    },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { pinId } = await params

  const pin = await prisma.pin.findUnique({ where: { id: pinId } })
  if (!pin || pin.userId !== auth.userId) return notFound()

  try {
    await requireWorkspaceAccess(auth.userId, pin.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  await prisma.pin.delete({ where: { id: pinId } })
  return Response.json({ ok: true })
}
