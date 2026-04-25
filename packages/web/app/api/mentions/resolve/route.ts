/**
 * POST /api/mentions/resolve
 * Preview endpoint: parses the supplied `body` and returns the list of
 * resolved mentions (users + agents) scoped to the active workspace.
 *
 * Used by the composer to chip-style @handles before posting.
 */

import { requireAuth, isAuthError, badRequest } from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { parseMentions, resolveMentions } from "@/lib/mentions/parse"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const raw = await req.json().catch(() => ({} as Record<string, unknown>))
  const body = (raw as { body?: unknown }).body
  const workspaceSlug = (raw as { workspaceSlug?: string | null }).workspaceSlug ?? null
  const workspaceIdHint = (raw as { workspaceId?: string | null }).workspaceId ?? null

  if (typeof body !== "string") return badRequest("body is required")

  let workspaceId: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: workspaceIdHint,
      workspaceSlug,
    })
    workspaceId = ws?.id ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  if (!workspaceId) {
    return Response.json({ mentions: [] })
  }

  const parsed = parseMentions(body)
  const mentions = await resolveMentions(parsed, { workspaceId })
  return Response.json({ mentions })
}
