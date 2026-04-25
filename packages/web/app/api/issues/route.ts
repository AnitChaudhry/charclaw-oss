/**
 * GET  /api/issues  — list issues for the current user (scoped to workspace)
 * POST /api/issues  — create a new issue (scoped to workspace)
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  const status = url.searchParams.get("status") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100)

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

  const issues = await prisma.issue.findMany({
    where: {
      userId: auth.userId,
      ...(workspaceId ? { workspaceId } : {}),
      ...(status && { status }),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      assigneeAgent: { select: { id: true, name: true, slug: true, avatarUrl: true, kind: true } },
      comments: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { comments: true } },
    },
  })

  return Response.json({ issues })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { title, body: issueBody, priority, assigneeAgentId, workspaceId, workspaceSlug } = body

  if (!title?.trim()) return badRequest("title is required")

  // Resolve workspace for the new issue.
  let activeWorkspaceId: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, { workspaceId, workspaceSlug })
    activeWorkspaceId = ws?.id ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  // Validate agent belongs to user
  if (assigneeAgentId) {
    const agent = await prisma.agentProfile.findUnique({ where: { id: assigneeAgentId } })
    if (!agent || agent.userId !== auth.userId) {
      return badRequest("Agent not found")
    }
  }

  const issue = await prisma.issue.create({
    data: {
      userId: auth.userId,
      workspaceId: activeWorkspaceId,
      title: title.trim(),
      body: issueBody ?? null,
      priority: priority ?? 0,
      status: assigneeAgentId ? "claimed" : "backlog",
      assigneeAgentId: assigneeAgentId ?? null,
    },
    include: {
      assigneeAgent: { select: { id: true, name: true, slug: true, avatarUrl: true, kind: true } },
    },
  })

  if (assigneeAgentId) {
    await prisma.issueEvent.create({
      data: { issueId: issue.id, kind: "assigned", payload: { agentId: assigneeAgentId } },
    })
    // If agent has a runtime, dispatch to daemon
    await dispatchToAgent(issue.id, assigneeAgentId, auth.userId)
  }

  return Response.json({ issue }, { status: 201 })
}

async function dispatchToAgent(issueId: string, agentId: string, _userId: string) {
  try {
    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      include: { runtime: true },
    })
    if (!agent?.runtime?.id) return

    const issue = await prisma.issue.findUnique({ where: { id: issueId } })
    if (!issue) return

    const { pushTaskToRuntime } = await import("@/lib/runtime/task-broadcast")
    pushTaskToRuntime(agent.runtime.id, {
      issueId,
      title: issue.title,
      body: issue.body,
      agent: agent.kind,
      model: agent.model ?? undefined,
      repoOwner: "",   // populated by the issue when a repo is linked
      repoName: "",
      baseBranch: "main",
      branchName: `agent/${issueId.slice(0, 8)}`,
      githubToken: "", // daemon will need to store its own token or be passed here
    })
  } catch (err) {
    console.warn("[issues] Failed to dispatch to daemon:", err)
  }
}
