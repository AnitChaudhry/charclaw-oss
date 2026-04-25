/**
 * POST /api/inbox/read-all
 * Mark all of the caller's unread InboxItems in the active workspace as read.
 * Body: `{ workspaceSlug?: string }` (optional — falls back to active workspace).
 * Returns `{ updated: <count> }`.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const workspaceSlug = (body as { workspaceSlug?: string | null }).workspaceSlug ?? null
  const workspaceIdHint = (body as { workspaceId?: string | null }).workspaceId ?? null

  let workspaceId: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: workspaceIdHint,
      workspaceSlug,
    })
    workspaceId = ws?.id ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  if (!workspaceId) {
    return Response.json({ updated: 0 })
  }

  const now = new Date()
  const result = await prisma.inboxItem.updateMany({
    where: {
      userId: auth.userId,
      workspaceId,
      readAt: null,
    },
    data: { readAt: now },
  })

  return Response.json({ updated: result.count })
}
