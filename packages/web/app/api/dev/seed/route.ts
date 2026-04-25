/**
 * POST /api/dev/seed — create sample fixtures in the caller's active
 * workspace (for local dev + verifier idempotence).
 *
 * Strict dev-only: returns 404 if `isAuthSkipped()` is false.
 * Authenticated: requires the dev session cookie.
 * Scoped: only writes into the caller's active workspace. Never touches
 * other users' workspaces or any shared tables.
 *
 * Body (all optional):
 *   {
 *     profiles?: boolean   // default true — Alice + Bob agent profiles
 *     project?: boolean    // default true — "Demo" project
 *     autopilot?: boolean  // default true — one disabled cron autopilot
 *     pin?: boolean        // default true — one "in-progress" issue-filter pin
 *   }
 *
 * Response: { ok: true, created: { profiles: 0|1|2, project: 0|1, ... } }
 *
 * Idempotent: skips anything that already exists for the same slug /
 * reference in the workspace.
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
  internalError,
} from "@/lib/shared/api-helpers"
import { isAuthSkipped } from "@/lib/auth/dev-auth"
import { getActiveWorkspace } from "@/lib/auth/workspace"

interface SeedBody {
  profiles?: boolean
  project?: boolean
  autopilot?: boolean
  pin?: boolean
}

interface SeedResult {
  profiles: number
  project: number
  autopilot: number
  pin: number
}

export async function POST(req: Request) {
  if (!isAuthSkipped()) return notFound()

  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const userId = auth.userId

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) {
    return Response.json({ error: "no active workspace" }, { status: 400 })
  }
  const workspaceId = workspace.id

  const body = (await req.json().catch(() => ({}))) as SeedBody
  const wantProfiles = body.profiles ?? true
  const wantProject = body.project ?? true
  const wantAutopilot = body.autopilot ?? true
  const wantPin = body.pin ?? true

  const created: SeedResult = { profiles: 0, project: 0, autopilot: 0, pin: 0 }

  try {
    // ── Agent profiles ──────────────────────────────────────────────────
    if (wantProfiles) {
      const samples = [
        {
          slug: "alice",
          name: "Alice",
          bio: "Sample agent. Claude Code runtime.",
          kind: "claude-code",
        },
        {
          slug: "bob",
          name: "Bob",
          bio: "Sample agent. Codex runtime.",
          kind: "codex",
        },
      ] as const

      for (const sample of samples) {
        const existing = await prisma.agentProfile.findUnique({
          where: { userId_slug: { userId, slug: sample.slug } },
        })
        if (existing) continue
        await prisma.agentProfile.create({
          data: {
            userId,
            workspaceId,
            slug: sample.slug,
            name: sample.name,
            bio: sample.bio,
            kind: sample.kind,
          },
        })
        created.profiles += 1
      }
    }

    // ── Sample project ──────────────────────────────────────────────────
    if (wantProject) {
      const existing = await prisma.project.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: "demo" } },
      })
      if (!existing) {
        await prisma.project.create({
          data: {
            workspaceId,
            slug: "demo",
            name: "Demo",
            description: "Sample project seeded by /api/dev/seed",
            color: "#6366f1",
          },
        })
        created.project = 1
      }
    }

    // ── Sample autopilot (disabled) ─────────────────────────────────────
    if (wantAutopilot) {
      const existing = await prisma.autopilot.findFirst({
        where: { workspaceId, name: "Weekly triage" },
        select: { id: true },
      })
      if (!existing) {
        await prisma.autopilot.create({
          data: {
            workspaceId,
            name: "Weekly triage",
            description: "Sample autopilot seeded by /api/dev/seed. Disabled by default.",
            enabled: false,
            trigger: "cron",
            schedule: "0 9 * * 1",
            timezone: "UTC",
            config: {
              titleTemplate: "Weekly triage — {date}",
              bodyTemplate: "## Agenda\n- Review open PRs\n- Sort backlog\n- Pick next priorities",
              priority: 0,
            },
            createdByUserId: userId,
          },
        })
        created.autopilot = 1
      }
    }

    // ── Sample pin ──────────────────────────────────────────────────────
    if (wantPin) {
      const existing = await prisma.pin.findFirst({
        where: { userId, workspaceId, label: "In progress" },
        select: { id: true },
      })
      if (!existing) {
        await prisma.pin.create({
          data: {
            userId,
            workspaceId,
            kind: "issue_filter",
            label: "In progress",
            filter: { status: "in_progress" },
          },
        })
        created.pin = 1
      }
    }

    return Response.json({ ok: true, workspaceId, created })
  } catch (err) {
    console.error("[dev/seed] failed", err)
    return internalError(err)
  }
}
