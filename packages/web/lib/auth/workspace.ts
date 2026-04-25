/**
 * Workspace auth helpers — Phase 1 of the multi-workspace foundation.
 *
 * A Workspace is the isolation boundary for Repos, Runtimes, AgentProfiles,
 * Issues, and Skills. Every user has a personal workspace auto-created at
 * migration time; users may additionally be members of other workspaces.
 *
 * The "active" workspace is currently defined as: the user's owned workspace
 * if they have one, else the first workspace they're a member of. A future
 * phase may let users explicitly switch and persist this.
 */

import { prisma } from "@/lib/db/prisma"

export interface ActiveWorkspace {
  id: string
  slug: string
}

export interface ResolvedWorkspace extends ActiveWorkspace {
  name: string
  role: string
}

/**
 * Error thrown by requireWorkspaceAccess* when the user is not a member of
 * the target workspace. Route handlers should catch this and return 403.
 */
export class WorkspaceAccessError extends Error {
  constructor(message = "Forbidden: not a member of this workspace") {
    super(message)
    this.name = "WorkspaceAccessError"
  }
}

/**
 * Returns the user's "active" workspace. Currently prefers the workspace
 * they own; falls back to their first membership. Returns null only for
 * users with no workspaces at all (should not happen after the backfill
 * migration).
 */
export async function getActiveWorkspace(
  userId: string
): Promise<ActiveWorkspace | null> {
  const owned = await prisma.workspace.findUnique({
    where: { ownerId: userId },
    select: { id: true, slug: true },
  })
  if (owned) return owned

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspace: { select: { id: true, slug: true } } },
  })
  return membership?.workspace ?? null
}

/**
 * Throws WorkspaceAccessError if the given user is not a member of the
 * given workspace. Used by API routes to gate every workspace-scoped read.
 */
export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<void> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  })
  if (!member) throw new WorkspaceAccessError()
}

/**
 * Resolves a workspace by slug and verifies membership in one step.
 * Throws WorkspaceAccessError if the workspace doesn't exist or the user
 * isn't a member.
 */
export async function requireWorkspaceAccessBySlug(
  userId: string,
  slug: string
): Promise<ActiveWorkspace> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  })
  if (!workspace) throw new WorkspaceAccessError("Workspace not found")
  await requireWorkspaceAccess(userId, workspace.id)
  return workspace
}

/**
 * Resolve the workspace the current request is targeting. Prefers an
 * explicit `workspaceId`/`workspaceSlug` hint (from query/body), falls back
 * to the user's active workspace. Throws WorkspaceAccessError if the user
 * is not a member of the resolved workspace. Returns null only when the
 * user has no workspaces at all.
 */
export async function resolveRequestWorkspace(
  userId: string,
  hint: { workspaceId?: string | null; workspaceSlug?: string | null }
): Promise<ActiveWorkspace | null> {
  if (hint.workspaceId) {
    await requireWorkspaceAccess(userId, hint.workspaceId)
    const ws = await prisma.workspace.findUnique({
      where: { id: hint.workspaceId },
      select: { id: true, slug: true },
    })
    if (!ws) throw new WorkspaceAccessError("Workspace not found")
    return ws
  }
  if (hint.workspaceSlug) {
    return await requireWorkspaceAccessBySlug(userId, hint.workspaceSlug)
  }
  return await getActiveWorkspace(userId)
}

/**
 * Helper: convert a WorkspaceAccessError to a 403 Response. Leaves other
 * errors to bubble up.
 */
export function workspaceAccessErrorResponse(err: unknown): Response | null {
  if (err instanceof WorkspaceAccessError) {
    return Response.json({ error: err.message }, { status: 403 })
  }
  return null
}
