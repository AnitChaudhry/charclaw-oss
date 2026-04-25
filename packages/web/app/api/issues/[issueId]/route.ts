/**
 * GET   /api/issues/[issueId]  — fetch single issue with comments + events
 * PATCH /api/issues/[issueId]  — update title, body, status, priority, assignee
 *
 * Workspace guard: if the issue has a workspaceId, the caller must have
 * access to that workspace. Ownership (issue.userId === auth.userId) is
 * still required on top of that.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, notFound, badRequest } from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { issueId } = await params

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      assigneeAgent: { select: { id: true, name: true, slug: true, avatarUrl: true, kind: true } },
      comments: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  })

  if (!issue || issue.userId !== auth.userId) return notFound()

  if (issue.workspaceId) {
    try {
      await requireWorkspaceAccess(auth.userId, issue.workspaceId)
    } catch (err) {
      const resp = workspaceAccessErrorResponse(err)
      if (resp) return resp
      throw err
    }
  }

  return Response.json({ issue })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { issueId } = await params

  const issue = await prisma.issue.findUnique({ where: { id: issueId } })
  if (!issue || issue.userId !== auth.userId) return notFound()

  if (issue.workspaceId) {
    try {
      await requireWorkspaceAccess(auth.userId, issue.workspaceId)
    } catch (err) {
      const resp = workspaceAccessErrorResponse(err)
      if (resp) return resp
      throw err
    }
  }

  const body = await req.json()
  const { title, body: issueBody, status, priority, assigneeAgentId } = body

  const VALID_STATUSES = ["backlog", "claimed", "in_progress", "blocked", "done", "failed"]
  if (status && !VALID_STATUSES.includes(status)) {
    return badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`)
  }

  const prevStatus = issue.status
  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      ...(title !== undefined && { title }),
      ...(issueBody !== undefined && { body: issueBody }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assigneeAgentId !== undefined && { assigneeAgentId }),
    },
    include: {
      assigneeAgent: { select: { id: true, name: true, slug: true, avatarUrl: true, kind: true } },
    },
  })

  if (status && status !== prevStatus) {
    await prisma.issueEvent.create({
      data: {
        issueId,
        kind: "status_change",
        payload: { from: prevStatus, to: status },
      },
    })
  }

  return Response.json({ issue: updated })
}
