/**
 * POST /api/runtime/progress
 * Daemon posts execution progress (running, blocked, completed, failed).
 * Writes an IssueComment + updates Issue status.
 */

import { prisma } from "@/lib/db/prisma"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"

type ProgressKind = "cloning" | "running" | "blocked" | "completed" | "failed"

const KIND_TO_STATUS: Partial<Record<ProgressKind, string>> = {
  running: "in_progress",
  blocked: "blocked",
  completed: "done",
  failed: "failed",
}

export async function POST(req: Request) {
  const auth = await requireDaemonAuth(req)
  if (auth instanceof Response) return auth

  const body = await req.json()
  const { issueId, kind, message, commits, branchName }: {
    issueId: string
    kind: ProgressKind
    message: string
    commits?: number
    branchName?: string
  } = body

  if (!issueId || !kind || !message) {
    return Response.json({ error: "Missing issueId, kind, or message" }, { status: 400 })
  }

  const issue = await prisma.issue.findUnique({ where: { id: issueId } })
  if (!issue || issue.userId !== auth.userId) {
    return Response.json({ error: "Issue not found" }, { status: 404 })
  }

  // Post a comment from the agent
  await prisma.issueComment.create({
    data: {
      issueId,
      authorAgent: "daemon",
      body: message,
    },
  })

  // Update issue status
  const newStatus = KIND_TO_STATUS[kind]
  const updates: Record<string, unknown> = {}
  if (newStatus) updates.status = newStatus

  // Store issue event
  await prisma.issueEvent.create({
    data: {
      issueId,
      kind,
      payload: { message, commits, branchName },
    },
  })

  if (Object.keys(updates).length > 0) {
    await prisma.issue.update({ where: { id: issueId }, data: updates })
  }

  return Response.json({ ok: true })
}
