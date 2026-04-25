/**
 * GET /api/inbox
 * List the current user's InboxItems scoped to the active workspace, ordered
 * by createdAt desc. Supports `?unread=1`, `?limit=50` (max 100),
 * `?cursor=<id>` (opaque — the id of the last seen item).
 *
 * Every query is workspace-filtered via resolveRequestWorkspace which calls
 * requireWorkspaceAccess under the hood.
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
  const unread = url.searchParams.get("unread") === "1"
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 100)
  const cursor = url.searchParams.get("cursor") ?? undefined

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
    return Response.json({ items: [], nextCursor: null })
  }

  const items = await prisma.inboxItem.findMany({
    where: {
      userId: auth.userId,
      workspaceId,
      ...(unread ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  })

  const hasMore = items.length > limit
  const trimmed = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null

  return Response.json({ items: trimmed, nextCursor })
}
