/**
 * GET  /api/pins — list caller's pins in the active workspace, ordered by
 *                  `position asc`. Each pin carries a resolved `href` so
 *                  the client doesn't need to re-derive URLs.
 * POST /api/pins — create a pin in the active workspace. Validates the
 *                  referenced entity (project / conversation / repo) lives
 *                  in the same workspace; validates URL pins point at a
 *                  safe http(s) target.
 *
 * Every query is scoped to `(userId, workspaceId)` and gated behind
 * `requireWorkspaceAccess` via `resolveRequestWorkspace`.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  internalError,
} from "@/lib/shared/api-helpers"
import {
  resolveRequestWorkspace,
  workspaceAccessErrorResponse,
} from "@/lib/auth/workspace"
import { resolveHref, isSafeExternalUrl } from "@/lib/pins/resolveHref"
import type { IssueFilter, PinKind } from "@/lib/types/pin"

const VALID_KINDS: PinKind[] = [
  "issue_filter",
  "project",
  "conversation",
  "repo",
  "url",
]

type StoredPinRow = {
  id: string
  kind: string
  label: string
  icon: string | null
  targetRef: string | null
  filter: unknown
  position: number
}

/**
 * Fetch any slug/label hints for pins that reference another entity,
 * so we can emit a human-friendly `href` without an extra round trip.
 * Only handles project pins for now (repos don't have workspace-scoped
 * slugs; conversations are keyed by id).
 */
async function resolveTargetSlugs(
  workspaceId: string,
  pins: StoredPinRow[]
): Promise<Map<string, string>> {
  const projectIds = pins
    .filter((p) => p.kind === "project" && p.targetRef)
    .map((p) => p.targetRef as string)

  const map = new Map<string, string>()
  if (projectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds }, workspaceId },
      select: { id: true, slug: true },
    })
    for (const p of projects) map.set(p.id, p.slug)
  }
  return map
}

function sanitizeFilter(raw: unknown): IssueFilter | null {
  if (raw == null || typeof raw !== "object") return null
  const f = raw as Record<string, unknown>
  const out: IssueFilter = {}
  if (typeof f.status === "string") out.status = f.status
  if (typeof f.assigneeAgentId === "string") out.assigneeAgentId = f.assigneeAgentId
  if (typeof f.projectId === "string") out.projectId = f.projectId
  if (typeof f.q === "string") out.q = f.q
  if (Array.isArray(f.tags)) {
    out.tags = f.tags.filter((t): t is string => typeof t === "string")
  }
  return out
}

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  let workspaceId: string | null = null
  let workspaceSlug: string | null = null
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: url.searchParams.get("workspaceId"),
      workspaceSlug: url.searchParams.get("workspaceSlug"),
    })
    workspaceId = ws?.id ?? null
    workspaceSlug = ws?.slug ?? null
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  if (!workspaceId || !workspaceSlug) {
    return Response.json({ pins: [] })
  }

  const rows = (await prisma.pin.findMany({
    where: { userId: auth.userId, workspaceId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      label: true,
      icon: true,
      targetRef: true,
      filter: true,
      position: true,
    },
  })) as StoredPinRow[]

  const slugMap = await resolveTargetSlugs(workspaceId, rows)

  const pins = rows.map((p) => {
    const filter = sanitizeFilter(p.filter)
    const targetSlug = p.targetRef ? slugMap.get(p.targetRef) ?? null : null
    return {
      id: p.id,
      kind: p.kind,
      label: p.label,
      icon: p.icon,
      targetRef: p.targetRef,
      filter,
      position: p.position,
      targetSlug,
      href: resolveHref(
        { kind: p.kind, targetRef: p.targetRef, targetSlug, filter },
        workspaceSlug as string
      ),
    }
  })

  return Response.json({ pins })
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

  const kind = typeof body.kind === "string" ? (body.kind as PinKind) : undefined
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const icon = typeof body.icon === "string" ? body.icon : null
  const targetRef = typeof body.targetRef === "string" ? body.targetRef : null
  const filter = sanitizeFilter(body.filter)
  const positionHint =
    typeof body.position === "number" && Number.isFinite(body.position)
      ? Math.trunc(body.position)
      : null

  if (!kind || !VALID_KINDS.includes(kind)) {
    return badRequest(
      `Invalid kind. Must be one of: ${VALID_KINDS.join(", ")}`
    )
  }
  if (!label) return badRequest("label is required")

  // Kind-specific payload validation.
  if (kind === "issue_filter") {
    // targetRef ignored; filter may be empty but should be an object.
  } else if (kind === "url") {
    if (!targetRef || !isSafeExternalUrl(targetRef)) {
      return badRequest("url pins require an http(s) targetRef")
    }
  } else {
    if (!targetRef) return badRequest(`${kind} pin requires a targetRef`)
  }

  const workspaceIdHint =
    typeof body.workspaceId === "string" ? body.workspaceId : null
  const workspaceSlugHint =
    typeof body.workspaceSlug === "string" ? body.workspaceSlug : null

  let workspaceId: string
  let workspaceSlug: string
  try {
    const ws = await resolveRequestWorkspace(auth.userId, {
      workspaceId: workspaceIdHint,
      workspaceSlug: workspaceSlugHint,
    })
    if (!ws) return badRequest("No active workspace — create one first")
    workspaceId = ws.id
    workspaceSlug = ws.slug
  } catch (err) {
    const resp = workspaceAccessErrorResponse(err)
    if (resp) return resp
    throw err
  }

  // Validate targetRef points at something inside this workspace.
  let targetSlug: string | null = null
  try {
    if (kind === "project") {
      const project = await prisma.project.findFirst({
        where: { id: targetRef as string, workspaceId },
        select: { id: true, slug: true },
      })
      if (!project) return badRequest("Project not found in this workspace")
      targetSlug = project.slug
    } else if (kind === "conversation") {
      const convo = await prisma.conversation.findFirst({
        where: { id: targetRef as string, workspaceId },
        select: { id: true },
      })
      if (!convo) return badRequest("Conversation not found in this workspace")
    } else if (kind === "repo") {
      const repo = await prisma.repo.findFirst({
        where: { id: targetRef as string, workspaceId },
        select: { id: true },
      })
      if (!repo) return badRequest("Repo not found in this workspace")
    }
  } catch (err) {
    return internalError(err)
  }

  // Compute default position as max(position)+1 scoped to (userId, workspaceId).
  let position = positionHint ?? 0
  if (positionHint == null) {
    const last = await prisma.pin.findFirst({
      where: { userId: auth.userId, workspaceId },
      orderBy: { position: "desc" },
      select: { position: true },
    })
    position = (last?.position ?? -1) + 1
  }

  const created = await prisma.pin.create({
    data: {
      userId: auth.userId,
      workspaceId,
      kind,
      label,
      icon,
      targetRef: kind === "issue_filter" ? null : targetRef,
      filter:
        kind === "issue_filter"
          ? ((filter ?? {}) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      position,
    },
    select: {
      id: true,
      kind: true,
      label: true,
      icon: true,
      targetRef: true,
      filter: true,
      position: true,
    },
  })

  const outFilter = sanitizeFilter(created.filter)
  const pin = {
    id: created.id,
    kind: created.kind,
    label: created.label,
    icon: created.icon,
    targetRef: created.targetRef,
    filter: outFilter,
    position: created.position,
    targetSlug,
    href: resolveHref(
      {
        kind: created.kind,
        targetRef: created.targetRef,
        targetSlug,
        filter: outFilter,
      },
      workspaceSlug
    ),
  }

  return Response.json({ pin }, { status: 201 })
}
