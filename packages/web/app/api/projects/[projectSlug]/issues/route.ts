/**
 * GET  /api/projects/[projectSlug]/issues  — list issues assigned to this
 *                                             project. Supports ?status=<status>.
 * POST /api/projects/[projectSlug]/issues  — assign a batch of existing issues
 *                                             to this project. Body:
 *                                             { issueIds: string[] }
 *
 * NEW route — does NOT touch existing /api/issues/** handlers. Exists so the
 * project detail view can fetch just the project's issues without a client-
 * side filter over the whole workspace.
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

const ISSUE_INCLUDE = {
  assigneeAgent: {
    select: {
      id: true,
      name: true,
      slug: true,
      avatarUrl: true,
      kind: true,
    },
  },
  comments: { orderBy: { createdAt: "desc" as const }, take: 1 },
  _count: { select: { comments: true } },
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
    select: { id: true, slug: true, workspaceId: true },
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

  const status = url.searchParams.get("status") ?? undefined
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "100"),
    200
  )

  const issues = await prisma.issue.findMany({
    where: {
      projectId: resolved.project.id,
      workspaceId: resolved.workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: ISSUE_INCLUDE,
  })

  return Response.json({ issues })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { projectSlug } = await params

  const body = await req.json().catch(() => ({}))
  const {
    issueIds,
    workspaceId: bodyWorkspaceId,
    workspaceSlug,
  } = body ?? {}

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return badRequest("issueIds must be a non-empty array")
  }
  if (!issueIds.every((id) => typeof id === "string" && id.length > 0)) {
    return badRequest("issueIds must be strings")
  }

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

  // Only touch issues that live in the same workspace as the project.
  const result = await prisma.issue.updateMany({
    where: {
      id: { in: issueIds as string[] },
      workspaceId: resolved.workspaceId,
    },
    data: { projectId: resolved.project.id },
  })

  return Response.json({
    ok: true,
    assigned: result.count,
    skipped: issueIds.length - result.count,
  })
}
