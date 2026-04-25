/**
 * POST /api/dev/reset — wipe workspace-scoped test data for the dev user.
 *
 * Strict dev-only: returns 404 if `isAuthSkipped()` is false (i.e.
 * `NODE_ENV === "production"` OR `GITHUB_PAT` is unset).
 *
 * Authenticated: requires the dev session cookie (401 otherwise).
 *
 * Scoped: only touches rows in the caller's active workspace. Never
 * touches other users' workspaces. Never touches schema or migrations.
 * Never deletes Workspace, WorkspaceMember, Runtime, User, UserCredentials,
 * Repo, Branch, Message, or Sandbox rows.
 *
 * Body (all optional):
 *   {
 *     scope?: "all" | ("projects" | "agents" | "conversations" |
 *                      "autopilots" | "pins" | "inbox" | "issues")[]
 *   }
 * Query:
 *   ?all=1   also drop AgentProfile rows older than 24h (default: keep them)
 *
 * Response: { ok: true, deleted: { projects: N, autopilots: N, ... } }
 */

import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  notFound,
  badRequest,
  internalError,
} from "@/lib/shared/api-helpers"
import { isAuthSkipped } from "@/lib/auth/dev-auth"
import { getActiveWorkspace } from "@/lib/auth/workspace"

type Scope =
  | "projects"
  | "agents"
  | "conversations"
  | "autopilots"
  | "pins"
  | "inbox"
  | "issues"

const ALL_SCOPES: Scope[] = [
  "inbox",
  "pins",
  "autopilots",
  "conversations",
  "issues",
  "projects",
  "agents",
]

function resolveScopes(
  raw: unknown
): Set<Scope> | { error: string } {
  if (raw === undefined || raw === null || raw === "all") {
    return new Set(ALL_SCOPES)
  }
  if (!Array.isArray(raw)) {
    return { error: 'scope must be "all" or an array of scope strings' }
  }
  const set = new Set<Scope>()
  for (const s of raw) {
    if (typeof s !== "string" || !(ALL_SCOPES as string[]).includes(s)) {
      return { error: `unknown scope: ${String(s)}` }
    }
    set.add(s as Scope)
  }
  return set
}

export async function POST(req: Request) {
  // Strict dev-only gate: hide the route entirely in prod / when the
  // GITHUB_PAT dev-bypass is off.
  if (!isAuthSkipped()) {
    return notFound()
  }

  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const url = new URL(req.url)
  const dropAllAgents = url.searchParams.get("all") === "1"

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const scopesResult = resolveScopes((body as { scope?: unknown }).scope)
  if ("error" in scopesResult) return badRequest(scopesResult.error)
  const scopes = scopesResult

  const ws = await getActiveWorkspace(auth.userId)
  if (!ws) return badRequest("No active workspace for dev user")
  const workspaceId = ws.id
  const userId = auth.userId

  const deleted: Record<string, number> = {}

  try {
    // 1. InboxItem (recipient = dev user, scoped to this workspace)
    if (scopes.has("inbox")) {
      const r = await prisma.inboxItem.deleteMany({
        where: { userId, workspaceId },
      })
      deleted.inbox = r.count
    }

    // 2. Pin (owned by dev user, scoped to this workspace)
    if (scopes.has("pins")) {
      const r = await prisma.pin.deleteMany({
        where: { userId, workspaceId },
      })
      deleted.pins = r.count
    }

    // 3. AutopilotRun -> Autopilot (workspace-scoped)
    if (scopes.has("autopilots")) {
      const runs = await prisma.autopilotRun.deleteMany({
        where: { autopilot: { workspaceId } },
      })
      const autopilots = await prisma.autopilot.deleteMany({
        where: { workspaceId },
      })
      deleted.autopilotRuns = runs.count
      deleted.autopilots = autopilots.count
    }

    // 4. ConversationMessage -> Conversation (workspace-scoped)
    if (scopes.has("conversations")) {
      const msgs = await prisma.conversationMessage.deleteMany({
        where: { conversation: { workspaceId } },
      })
      const convs = await prisma.conversation.deleteMany({
        where: { workspaceId },
      })
      deleted.conversationMessages = msgs.count
      deleted.conversations = convs.count
    }

    // 5. IssueEvent / IssueComment / Issue (workspace-scoped)
    if (scopes.has("issues")) {
      const events = await prisma.issueEvent.deleteMany({
        where: { issue: { workspaceId } },
      })
      const comments = await prisma.issueComment.deleteMany({
        where: { issue: { workspaceId } },
      })
      const issues = await prisma.issue.deleteMany({
        where: { workspaceId },
      })
      deleted.issueEvents = events.count
      deleted.issueComments = comments.count
      deleted.issues = issues.count
    }

    // 6. Project (workspace-scoped)
    //    Note: any Issues that remained (e.g. scope skipped "issues") will
    //    have their projectId set to NULL by the existing onDelete: SetNull.
    if (scopes.has("projects")) {
      const r = await prisma.project.deleteMany({
        where: { workspaceId },
      })
      deleted.projects = r.count
    }

    // 7. AgentProfile (workspace-scoped) — keep long-lived profiles created
    //    by the dev user more than 24h ago unless ?all=1 is passed.
    if (scopes.has("agents")) {
      if (dropAllAgents) {
        const r = await prisma.agentProfile.deleteMany({
          where: { workspaceId },
        })
        deleted.agentProfiles = r.count
      } else {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
        // Drop every workspace profile EXCEPT those the dev user created
        // more than 24h ago.
        const r = await prisma.agentProfile.deleteMany({
          where: {
            workspaceId,
            NOT: {
              userId,
              createdAt: { lt: cutoff },
            },
          },
        })
        deleted.agentProfiles = r.count
      }
    }

    return Response.json({ ok: true, deleted, workspaceId })
  } catch (err) {
    console.error("[dev/reset] failed", err)
    return internalError(err)
  }
}
