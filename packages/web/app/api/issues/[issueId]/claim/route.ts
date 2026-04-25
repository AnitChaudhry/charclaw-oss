/**
 * POST /api/issues/[issueId]/claim
 * Agent claims an issue — transitions it from "backlog" → "claimed" → "in_progress".
 * Can be called by the web UI (assign dialog) or by the daemon when it starts execution.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest, notFound } from "@/lib/shared/api-helpers"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params

  // Allow both web session auth and daemon token auth
  let userId: string
  const authHeader = req.headers.get("authorization") ?? ""

  if (authHeader.startsWith("Bearer daemon_")) {
    const daemonAuth = await requireDaemonAuth(req)
    if (daemonAuth instanceof Response) return daemonAuth
    userId = daemonAuth.userId
  } else {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth
    userId = auth.userId
  }

  const body = await req.json()
  const { agentId, status = "in_progress" } = body

  const issue = await prisma.issue.findUnique({ where: { id: issueId } })
  if (!issue || issue.userId !== userId) return notFound("Issue not found")

  if (!["backlog", "claimed"].includes(issue.status)) {
    return badRequest(`Issue is already ${issue.status}`)
  }

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      status,
      ...(agentId && { assigneeAgentId: agentId }),
    },
    include: {
      assigneeAgent: { select: { id: true, name: true, slug: true, kind: true } },
    },
  })

  await prisma.issueEvent.create({
    data: {
      issueId,
      kind: "status_change",
      payload: { from: issue.status, to: status, agentId },
    },
  })

  return Response.json({ issue: updated })
}
