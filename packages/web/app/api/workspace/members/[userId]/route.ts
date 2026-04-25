import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"

/**
 * DELETE /api/workspace/members/[userId] - Remove a member from the workspace (owner only)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const { userId: memberUserId } = await params

  if (!memberUserId) {
    return badRequest("User ID is required")
  }

  // Find user's owned workspace
  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: auth.userId },
  })

  if (!workspace) {
    return notFound("You don't own a workspace")
  }

  if (memberUserId === auth.userId) {
    return badRequest("You can't remove yourself from your own workspace")
  }

  // Find the membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: memberUserId },
    },
  })

  if (!membership) {
    return notFound("User is not a member of your workspace")
  }

  await prisma.workspaceMember.delete({ where: { id: membership.id } })

  return Response.json({ success: true })
}
