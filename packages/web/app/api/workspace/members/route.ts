import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"

/**
 * POST /api/workspace/members - Add a member to the workspace (owner only)
 * Body: { githubUsername: string }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { githubUsername } = body

  if (!githubUsername || typeof githubUsername !== "string") {
    return badRequest("GitHub username is required")
  }

  // Find user's owned workspace
  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: auth.userId },
  })

  if (!workspace) {
    return notFound("You don't own a workspace")
  }

  // Find the user to add by GitHub username
  const userToAdd = await prisma.user.findFirst({
    where: { githubLogin: githubUsername.replace(/^@/, "") },
  })

  if (!userToAdd) {
    return badRequest("User not found. Make sure they have signed in at least once.")
  }

  if (userToAdd.id === auth.userId) {
    return badRequest("You can't add yourself to your own workspace")
  }

  // Guard against double-adding the same member.
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: userToAdd.id } },
  })
  if (existing) {
    return badRequest("User is already a member of this workspace")
  }

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: userToAdd.id,
      role: "member",
    },
    include: {
      user: {
        select: { id: true, name: true, githubLogin: true, image: true },
      },
    },
  })

  return Response.json({
    member: {
      id: member.user.id,
      name: member.user.name,
      githubLogin: member.user.githubLogin,
      image: member.user.image,
      joinedAt: member.createdAt,
    },
  })
}
