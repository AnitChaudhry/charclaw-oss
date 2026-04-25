import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
} from "@/lib/shared/api-helpers"

/**
 * POST /api/workspace/leave - Leave a workspace (non-owner membership)
 *
 * This drops any memberships where the user is NOT the owner. The user's
 * personal workspace (which they own) is left untouched.
 */
export async function POST() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId: auth.userId,
      workspace: { NOT: { ownerId: auth.userId } },
    },
    select: { id: true },
  })

  if (memberships.length === 0) {
    return notFound("You are not a member of any other workspace")
  }

  await prisma.workspaceMember.deleteMany({
    where: { id: { in: memberships.map((m) => m.id) } },
  })

  return Response.json({ success: true })
}
