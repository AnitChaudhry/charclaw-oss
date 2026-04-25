/**
 * GET  /api/workspaces — list workspaces the current user has access to
 *                        (owned + members-of), with role.
 * POST /api/workspaces — create a new workspace with the current user as owner.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"

export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          avatarUrl: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    name: m.workspace.name,
    description: m.workspace.description,
    avatarUrl: m.workspace.avatarUrl,
    role: m.role,
    isOwner: m.workspace.ownerId === auth.userId,
    createdAt: m.workspace.createdAt,
    updatedAt: m.workspace.updatedAt,
  }))

  return Response.json({ workspaces })
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,49}$/

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body")

  const { name, slug, description, avatarUrl } = body as {
    name?: unknown
    slug?: unknown
    description?: unknown
    avatarUrl?: unknown
  }

  if (typeof name !== "string" || !name.trim()) return badRequest("name is required")
  if (typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
    return badRequest(
      "slug must be 2-50 chars, lowercase alphanumeric or hyphen, starting with a letter/number"
    )
  }

  const existing = await prisma.workspace.findUnique({ where: { slug } })
  if (existing) return badRequest("A workspace with that slug already exists")

  const workspace = await prisma.workspace.create({
    data: {
      ownerId: auth.userId,
      name: name.trim(),
      slug,
      description: typeof description === "string" ? description : null,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
      members: {
        create: { userId: auth.userId, role: "owner" },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json(
    {
      workspace: { ...workspace, role: "owner", isOwner: true },
    },
    { status: 201 }
  )
}
