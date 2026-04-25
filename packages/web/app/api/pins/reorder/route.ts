/**
 * POST /api/pins/reorder — bulk-update pin `position` values in a single
 * transaction. Body shape: `{ order: [{ id, position }] }`.
 *
 * All ids in the payload must belong to the caller AND live in the same
 * workspace; anything else aborts the transaction with a 404.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccess,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

interface OrderEntry {
  id: string
  position: number
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return badRequest("Invalid JSON body")
  }

  const rawOrder = body.order
  if (!Array.isArray(rawOrder) || rawOrder.length === 0) {
    return badRequest("order must be a non-empty array")
  }

  const order: OrderEntry[] = []
  for (const entry of rawOrder) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as OrderEntry).id !== "string" ||
      typeof (entry as OrderEntry).position !== "number" ||
      !Number.isFinite((entry as OrderEntry).position)
    ) {
      return badRequest("order entries must be { id: string, position: number }")
    }
    order.push({
      id: (entry as OrderEntry).id,
      position: Math.trunc((entry as OrderEntry).position),
    })
  }

  const ids = order.map((o) => o.id)
  const pins = await prisma.pin.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true, workspaceId: true },
  })

  if (pins.length !== ids.length) return notFound("One or more pins not found")
  for (const p of pins) {
    if (p.userId !== auth.userId) return notFound()
  }

  // All pins in a reorder call must share a workspace — otherwise the
  // "ordered list" has no meaning.
  const workspaceIds = new Set(pins.map((p) => p.workspaceId))
  if (workspaceIds.size !== 1) {
    return badRequest("All pins must belong to the same workspace")
  }
  const workspaceId = pins[0].workspaceId

  try {
    await requireWorkspaceAccess(auth.userId, workspaceId)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  await prisma.$transaction(
    order.map((o) =>
      prisma.pin.update({
        where: { id: o.id },
        data: { position: o.position },
      })
    )
  )

  return Response.json({ ok: true })
}
