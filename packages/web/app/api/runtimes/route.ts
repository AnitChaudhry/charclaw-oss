/**
 * GET    /api/runtimes  — list the current user's registered runtimes (workspace-scoped)
 * DELETE /api/runtimes?id=<runtimeId>  — remove a runtime (workspace-guarded)
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)

  // Per-sandbox query: return just the runtime that the given sandbox is
  // bound to. Used by the chat picker to gate agents to the runtime that
  // will actually run this branch's turn — narrower than the union across
  // all the user's runtimes.
  const sandboxId = url.searchParams.get("sandboxId")
  if (sandboxId) {
    const sandbox = await prisma.sandbox.findFirst({
      where: { sandboxId, userId: auth.userId },
      select: {
        runtime: {
          select: {
            id: true,
            name: true,
            kind: true,
            status: true,
            workspaceRoot: true,
            workspaceId: true,
            capabilities: true,
            lastHeartbeat: true,
            createdAt: true,
          },
        },
      },
    })
    const runtimes = sandbox?.runtime ? [sandbox.runtime] : []
    return Response.json({ runtimes })
  }

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

  const runtimes = await prisma.runtime.findMany({
    where: {
      userId: auth.userId,
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      workspaceRoot: true,
      workspaceId: true,
      capabilities: true,
      lastHeartbeat: true,
      createdAt: true,
    },
  })

  return Response.json({ runtimes })
}

export async function DELETE(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  const runtime = await prisma.runtime.findUnique({ where: { id } })
  if (!runtime || runtime.userId !== auth.userId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await requireWorkspaceAccess(auth.userId, runtime.workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  await prisma.runtime.delete({ where: { id } })
  return Response.json({ ok: true })
}
