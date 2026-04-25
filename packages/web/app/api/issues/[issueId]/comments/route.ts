/**
 * GET  /api/issues/[issueId]/comments  — list comments on an issue
 * POST /api/issues/[issueId]/comments  — post a new comment
 *
 * POST additionally parses @mentions, persists the resolved list onto
 * IssueComment.mentions (JSON), and fans out InboxItems for each mentioned
 * workspace member. Workspace access is checked via requireWorkspaceAccess.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
  badRequest,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { parseMentions, resolveMentions } from "@/lib/mentions/parse"
import { fanoutMentions } from "@/lib/mentions/fanout"

export async function GET(
  _req: Request,
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

  const comments = await prisma.issueComment.findMany({
    where: { issueId },
    orderBy: { createdAt: "asc" },
  })
  return Response.json({ comments })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { issueId } = await params

  const raw = await req.json().catch(() => ({} as Record<string, unknown>))
  const body = (raw as { body?: unknown }).body
  if (typeof body !== "string" || !body.trim()) {
    return badRequest("body is required")
  }

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

  // Parse + resolve mentions against the issue's workspace (if any).
  const parsed = parseMentions(body)
  const resolved = issue.workspaceId
    ? await resolveMentions(parsed, { workspaceId: issue.workspaceId })
    : []

  const comment = await prisma.issueComment.create({
    data: {
      issueId,
      authorUserId: auth.userId,
      body,
      mentions:
        resolved.length > 0
          ? (resolved as unknown as Prisma.InputJsonValue)
          : undefined,
    },
  })

  if (issue.workspaceId && resolved.length > 0) {
    await fanoutMentions({
      mentions: resolved,
      refType: "issue",
      refId: issue.id,
      workspaceId: issue.workspaceId,
      actorUserId: auth.userId,
      summary: body.length > 200 ? body.slice(0, 200) + "…" : body,
    })
  }

  return Response.json({ comment }, { status: 201 })
}
