/**
 * GET /api/workspaces/[slug] — workspace detail.
 *
 * Caller must be a member of the workspace (owner membership counts).
 * Includes a member list so the UI can render team-sharing state.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
} from "@/lib/shared/api-helpers"
import {
  requireWorkspaceAccessBySlug,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { slug } = await params

  try {
    await requireWorkspaceAccessBySlug(auth.userId, slug)
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      owner: {
        select: { id: true, name: true, githubLogin: true, image: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, githubLogin: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!workspace) return notFound("Workspace not found")

  return Response.json({
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      description: workspace.description,
      avatarUrl: workspace.avatarUrl,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: workspace.owner,
      members: workspace.members.map((m) => ({
        id: m.user.id,
        userId: m.user.id,
        name: m.user.name,
        githubLogin: m.user.githubLogin,
        image: m.user.image,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    },
  })
}
