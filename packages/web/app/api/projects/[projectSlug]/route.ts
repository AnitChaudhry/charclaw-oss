/**
 * GET    /api/projects/[projectSlug]  — fetch a single project (with issueCount).
 * PATCH  /api/projects/[projectSlug]  — update name/description/color/icon/archivedAt.
 * DELETE /api/projects/[projectSlug]  — soft-delete (sets archivedAt). ?hard=1
 *                                       hard-deletes (owner/admin only).
 *
 * Access model: project lookup is scoped by workspaceSlug or by the caller's
 * active workspace, then requireWorkspaceAccess() enforces membership.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

interface Params {
  projectSlug: string
}

async function resolveProject(
  userId: string,
  projectSlug: string,
  workspaceHint: { workspaceId?: string | null; workspaceSlug?: string | null }
) {
  const ws = await resolveRequestWorkspace(userId, workspaceHint)
  if (!ws) return null
  const project = await prisma.project.findUnique({
    where: { workspaceId_slug: { workspaceId: ws.id, slug: projectSlug } },
  })
  return project ? { project, workspaceId: ws.id } : null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { projectSlug } = await params

  const url = new URL(req.url)
  let resolved: Awaited<ReturnType<typeof resolveProject>> = null
  try {
    resolved = await resolveProject(auth.userId, projectSlug, {
      workspaceId: url.searchParams.get("workspaceId"),
      workspaceSlug: url.searchParams.get("workspaceSlug"),
    })
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }
  if (!resolved) return notFound("Project not found")

  const issueCount = await prisma.issue.count({
    where: { projectId: resolved.project.id, workspaceId: resolved.workspaceId },
  })

  return Response.json({
    project: { ...resolved.project, issueCount },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { projectSlug } = await params

  const body = await req.json().catch(() => ({}))
  const { workspaceId: bodyWorkspaceId, workspaceSlug, ...patch } = body ?? {}

  let resolved: Awaited<ReturnType<typeof resolveProject>> = null
  try {
    resolved = await resolveProject(auth.userId, projectSlug, {
      workspaceId: bodyWorkspaceId,
      workspaceSlug,
    })
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }
  if (!resolved) return notFound("Project not found")

  const data: Record<string, unknown> = {}
  if (typeof patch.name === "string") {
    if (!patch.name.trim()) return badRequest("name cannot be empty")
    data.name = patch.name.trim()
  }
  if (patch.description === null || typeof patch.description === "string") {
    data.description = patch.description
  }
  if (patch.color === null || typeof patch.color === "string") {
    data.color = patch.color
  }
  if (patch.icon === null || typeof patch.icon === "string") {
    data.icon = patch.icon
  }
  if (patch.archivedAt === null) {
    data.archivedAt = null
  } else if (typeof patch.archivedAt === "string") {
    const parsed = new Date(patch.archivedAt)
    if (Number.isNaN(parsed.getTime())) {
      return badRequest("archivedAt must be a valid ISO date string or null")
    }
    data.archivedAt = parsed
  }

  const updated = await prisma.project.update({
    where: { id: resolved.project.id },
    data,
  })

  const issueCount = await prisma.issue.count({
    where: { projectId: updated.id, workspaceId: resolved.workspaceId },
  })

  return Response.json({ project: { ...updated, issueCount } })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { projectSlug } = await params

  const url = new URL(req.url)
  const hard = url.searchParams.get("hard") === "1"

  let resolved: Awaited<ReturnType<typeof resolveProject>> = null
  try {
    resolved = await resolveProject(auth.userId, projectSlug, {
      workspaceId: url.searchParams.get("workspaceId"),
      workspaceSlug: url.searchParams.get("workspaceSlug"),
    })
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }
  if (!resolved) return notFound("Project not found")

  if (hard) {
    // Hard delete gated to workspace owners/admins.
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: resolved.workspaceId,
          userId: auth.userId,
        },
      },
      select: { role: true },
    })
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return Response.json(
        { error: "Forbidden: owner or admin required for hard delete" },
        { status: 403 }
      )
    }

    await prisma.project.delete({ where: { id: resolved.project.id } })
    return Response.json({ ok: true, deleted: "hard" })
  }

  // Soft-delete: just stamp archivedAt if not already set.
  const archived = await prisma.project.update({
    where: { id: resolved.project.id },
    data: {
      archivedAt: resolved.project.archivedAt ?? new Date(),
    },
  })

  return Response.json({
    ok: true,
    deleted: "soft",
    project: archived,
  })
}
