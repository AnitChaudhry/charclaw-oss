/**
 * POST /api/issues/assign-project
 *
 * Assigns (or clears) a project on a single issue. Separate, NEW route so we
 * don't modify the existing /api/issues/** handlers.
 *
 *   Body: { issueId: string, projectId: string | null }
 *
 * Validates that both the issue and the target project live in the same
 * workspace, and that the caller has access to that workspace. `projectId:
 * null` un-assigns.
 */

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

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const { issueId, projectId } = body ?? {}

  if (!issueId || typeof issueId !== "string") {
    return badRequest("issueId is required")
  }
  if (projectId !== null && typeof projectId !== "string") {
    return badRequest("projectId must be a string or null")
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      projectId: true,
    },
  })
  if (!issue) return notFound("Issue not found")
  if (issue.userId !== auth.userId) return notFound("Issue not found")

  if (!issue.workspaceId) {
    return badRequest("Issue has no workspace; cannot assign a project")
  }

  try {
    await requireWorkspaceAccess(auth.userId, issue.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })
    if (!project) return notFound("Project not found")
    if (project.workspaceId !== issue.workspaceId) {
      return badRequest("Project and issue must be in the same workspace")
    }
  }

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: { projectId: projectId ?? null },
    include: {
      assigneeAgent: {
        select: { id: true, name: true, slug: true, avatarUrl: true, kind: true },
      },
    },
  })

  return Response.json({ issue: updated })
}
