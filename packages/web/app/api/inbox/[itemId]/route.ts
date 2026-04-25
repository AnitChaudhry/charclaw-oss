/**
 * PATCH  /api/inbox/[itemId]  — update read state (`{ readAt: string|null }`)
 * DELETE /api/inbox/[itemId]  — hard delete the item
 *
 * The item must belong to the caller.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
  badRequest,
} from "@/lib/shared/api-helpers"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { itemId } = await params

  const item = await prisma.inboxItem.findUnique({ where: { id: itemId } })
  if (!item || item.userId !== auth.userId) return notFound()

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  if (!("readAt" in body)) return badRequest("readAt is required")
  const rawReadAt = (body as { readAt?: string | null }).readAt

  let readAt: Date | null
  if (rawReadAt === null) {
    readAt = null
  } else if (typeof rawReadAt === "string") {
    const parsed = new Date(rawReadAt)
    if (Number.isNaN(parsed.getTime())) return badRequest("readAt must be an ISO datetime or null")
    readAt = parsed
  } else {
    return badRequest("readAt must be an ISO datetime string or null")
  }

  const updated = await prisma.inboxItem.update({
    where: { id: itemId },
    data: { readAt },
  })

  return Response.json({ item: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { itemId } = await params

  const item = await prisma.inboxItem.findUnique({ where: { id: itemId } })
  if (!item || item.userId !== auth.userId) return notFound()

  await prisma.inboxItem.delete({ where: { id: itemId } })
  return Response.json({ ok: true })
}
