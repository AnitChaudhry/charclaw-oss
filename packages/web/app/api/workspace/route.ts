import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"

/**
 * GET /api/workspace - Get the current user's personal workspace info
 *
 * Preserves the shape that the old /api/team route returned so the desktop
 * client (and the legacy team page) keeps working during the transition.
 */
export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  // Check if user owns a workspace
  const ownedWorkspace = await prisma.workspace.findUnique({
    where: { ownerId: auth.userId },
    include: {
      members: {
        where: { userId: { not: auth.userId } },
        include: {
          user: {
            select: { id: true, name: true, githubLogin: true, image: true },
          },
        },
      },
    },
  })

  if (ownedWorkspace) {
    return Response.json({
      team: {
        id: ownedWorkspace.id,
        isOwner: true,
        members: ownedWorkspace.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          githubLogin: m.user.githubLogin,
          image: m.user.image,
          joinedAt: m.createdAt,
        })),
      },
    })
  }

  // Otherwise surface the first non-owned membership (mirrors the old
  // "I'm a member of someone's team" UI).
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: auth.userId,
      workspace: { NOT: { ownerId: auth.userId } },
    },
    include: {
      workspace: {
        include: {
          owner: {
            select: { id: true, name: true, githubLogin: true, image: true },
          },
        },
      },
    },
  })

  if (membership) {
    return Response.json({
      team: {
        id: membership.workspace.id,
        isOwner: false,
        owner: {
          id: membership.workspace.owner.id,
          name: membership.workspace.owner.name,
          githubLogin: membership.workspace.owner.githubLogin,
          image: membership.workspace.owner.image,
        },
      },
    })
  }

  return Response.json({ team: null })
}

/**
 * POST /api/workspace - Create a new workspace (user becomes owner)
 *
 * Note: every user is auto-backfilled with a personal workspace at
 * migration time, so this path is mostly for legacy clients that still
 * POST /api/team. We keep the "already owns one" behavior from the old
 * endpoint.
 */
export async function POST() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const existing = await prisma.workspace.findUnique({
    where: { ownerId: auth.userId },
  })

  if (existing) {
    return badRequest("You already own a workspace")
  }

  // Build a default slug from the user's GitHub login.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { githubLogin: true, name: true },
  })

  const baseSlug = (user?.githubLogin?.toLowerCase() ?? "user") + "-ws"

  const workspace = await prisma.workspace.create({
    data: {
      ownerId: auth.userId,
      name: user?.name ?? user?.githubLogin ?? "Personal",
      slug: `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`,
      members: {
        create: { userId: auth.userId, role: "owner" },
      },
    },
  })

  return Response.json({
    team: {
      id: workspace.id,
      isOwner: true,
      members: [],
    },
  })
}

/**
 * DELETE /api/workspace - Delete the user's owned workspace
 */
export async function DELETE() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: auth.userId },
  })

  if (!workspace) {
    return notFound("You don't own a workspace")
  }

  await prisma.workspace.delete({ where: { id: workspace.id } })
  return Response.json({ success: true })
}
