/**
 * Mention parsing + resolution helpers.
 *
 * Scans a body of text for `@handle` tokens, then resolves each handle to
 * either a workspace member (by User.githubLogin) or an AgentProfile
 * (by slug) scoped to the workspace. Unresolvable handles are dropped.
 *
 * Store the resolved array on IssueComment.mentions / ConversationMessage.mentions.
 */

import { prisma } from "@/lib/db/prisma"

export type MentionKind = "user" | "agent"

export interface ParsedMention {
  /** the full match including the @ sign, e.g. "@aria" */
  raw: string
  /** inferred kind — until we resolve we treat everything as unknown; we still
   *  set a default of "user" here. Resolution is what actually decides. */
  kind: MentionKind
  /** the handle WITHOUT the leading @ sign */
  handle: string
  /** start index of the match in the body (points at the @) */
  index: number
}

export interface ResolvedMention {
  kind: MentionKind
  /** User.id or AgentProfile.id */
  id: string
  /** user githubLogin or agent slug */
  handle: string
  displayName: string
}

/**
 * Scan `body` for `@handle` tokens. We match when the `@` is at the start of
 * the string OR is preceded by whitespace — this avoids false positives on
 * email addresses. Handles may contain lowercase/uppercase letters, digits,
 * `_` and `-`, and are 1–40 chars.
 */
export function parseMentions(body: string): ParsedMention[] {
  if (!body) return []
  const regex = /(^|\s)@([a-zA-Z0-9_-]{1,40})\b/g
  const out: ParsedMention[] = []
  const seen = new Set<string>()

  for (const match of body.matchAll(regex)) {
    const leading = match[1] ?? ""
    const handle = match[2]
    if (!handle) continue
    const atIndex = (match.index ?? 0) + leading.length
    const lower = handle.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push({
      raw: `@${handle}`,
      kind: "user",
      handle,
      index: atIndex,
    })
  }

  return out
}

/**
 * Resolve parsed mentions to concrete users or agents within a workspace.
 * User mentions take precedence: if a WorkspaceMember has User.githubLogin
 * matching the handle we return a user mention. Otherwise we try to match
 * AgentProfile.slug within the workspace. Anything else is dropped.
 */
export async function resolveMentions(
  parsed: ParsedMention[],
  { workspaceId }: { workspaceId: string }
): Promise<ResolvedMention[]> {
  if (parsed.length === 0) return []

  const handles = Array.from(new Set(parsed.map((p) => p.handle)))
  const lowerHandles = handles.map((h) => h.toLowerCase())

  // Users: workspace members whose githubLogin matches any handle (case-insensitive).
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      user: {
        githubLogin: { in: handles, mode: "insensitive" },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          githubLogin: true,
        },
      },
    },
  })

  const userByHandle = new Map<string, { id: string; handle: string; displayName: string }>()
  for (const m of members) {
    const login = m.user.githubLogin
    if (!login) continue
    userByHandle.set(login.toLowerCase(), {
      id: m.user.id,
      handle: login,
      displayName: m.user.name ?? login,
    })
  }

  // Agents: workspace-scoped AgentProfile.slug matches.
  const remaining = lowerHandles.filter((h) => !userByHandle.has(h))
  let agents: { id: string; slug: string; name: string }[] = []
  if (remaining.length > 0) {
    agents = await prisma.agentProfile.findMany({
      where: {
        workspaceId,
        slug: { in: remaining, mode: "insensitive" },
      },
      select: { id: true, slug: true, name: true },
    })
  }

  const agentByHandle = new Map<string, { id: string; handle: string; displayName: string }>()
  for (const a of agents) {
    agentByHandle.set(a.slug.toLowerCase(), {
      id: a.id,
      handle: a.slug,
      displayName: a.name,
    })
  }

  const resolved: ResolvedMention[] = []
  const seenIds = new Set<string>()
  for (const p of parsed) {
    const key = p.handle.toLowerCase()
    const user = userByHandle.get(key)
    if (user) {
      if (seenIds.has(`user:${user.id}`)) continue
      seenIds.add(`user:${user.id}`)
      resolved.push({ kind: "user", id: user.id, handle: user.handle, displayName: user.displayName })
      continue
    }
    const agent = agentByHandle.get(key)
    if (agent) {
      if (seenIds.has(`agent:${agent.id}`)) continue
      seenIds.add(`agent:${agent.id}`)
      resolved.push({ kind: "agent", id: agent.id, handle: agent.handle, displayName: agent.displayName })
      continue
    }
    // otherwise drop it
  }
  return resolved
}
