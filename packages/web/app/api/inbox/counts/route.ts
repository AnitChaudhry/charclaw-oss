/**
 * GET /api/inbox/counts
 * Lightweight endpoint used by the inbox bell badge: returns total +
 * unread counts for the caller in their active workspace.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)

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

  if (!workspaceId) {
    return Response.json({ total: 0, unread: 0 })
  }

  const [total, unread] = await Promise.all([
    prisma.inboxItem.count({
      where: { userId: auth.userId, workspaceId },
    }),
    prisma.inboxItem.count({
      where: { userId: auth.userId, workspaceId, readAt: null },
    }),
  ])

  return Response.json({ total, unread })
}
