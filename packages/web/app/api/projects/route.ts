/**
 * GET  /api/projects  — list projects in the active (or hinted) workspace.
 *                      Supports ?workspaceSlug=<slug>, ?includeArchived=1.
 * POST /api/projects  — create a project in the active (or hinted) workspace.
 *
 * Access model: every request resolves a workspace via
 * resolveRequestWorkspace(), which internally calls requireWorkspaceAccess().
 * Non-members receive 403.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
} from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,48}$/

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  const includeArchived = url.searchParams.get("includeArchived") === "1"

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

  if (!workspaceId) return Response.json({ projects: [] })

  const rows = await prisma.project.findMany({
    where: {
      workspaceId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { issues: true } } },
  })

  const projects = rows.map((p) => ({
    id: p.id,
    workspaceId: p.workspaceId,
    slug: p.slug,
    name: p.name,
    description: p.description,
    color: p.color,
    icon: p.icon,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    issueCount: p._count.issues,
  }))

  return Response.json({ projects })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const {
    name,
    slug,
    description,
    color,
    icon,
    workspaceId: bodyWorkspaceId,
    workspaceSlug,
  } = body ?? {}

  if (!name || typeof name !== "string" || !name.trim()) {
    return badRequest("name is required")
  }
  if (!slug || typeof slug !== "string") {
    return badRequest("slug is required")
  }
  if (!SLUG_REGEX.test(slug)) {
    return badRequest(
      "slug must be 1–49 chars, lowercase alphanumeric with hyphens, starting with a letter or digit"
    )
  }

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

  const existing = await prisma.project.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    select: { id: true },
  })
  if (existing) return badRequest("Slug already in use in this workspace")

  const project = await prisma.project.create({
    data: {
      workspaceId,
      name: name.trim(),
      slug,
      description: typeof description === "string" ? description : null,
      color: typeof color === "string" ? color : null,
      icon: typeof icon === "string" ? icon : null,
    },
  })

  return Response.json(
    {
      project: {
        ...project,
        issueCount: 0,
      },
    },
    { status: 201 }
  )
}
