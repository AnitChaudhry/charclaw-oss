/**
 * Mention fan-out: for each resolved user mention, create an InboxItem so
 * the recipient sees the mention in their inbox feed. Agent mentions are
 * currently NOT fanned-out to InboxItem (agents do not have inbox feeds).
 *
 * Self-mentions are skipped — no point notifying someone about their own
 * comment. We also best-effort deduplicate by (userId, refType, refId,
 * kind="mention") in a single batched insert to avoid spam if the same
 * comment is reprocessed.
 */

import { prisma } from "@/lib/db/prisma"
import type { ResolvedMention } from "./parse"

export interface FanoutArgs {
  mentions: ResolvedMention[]
  refType: string // "comment" | "message" | "issue" | etc — see InboxItem.refType
  refId: string
  workspaceId: string
  actorUserId?: string | null
  actorAgentSlug?: string | null
  summary?: string | null
}

export async function fanoutMentions({
  mentions,
  refType,
  refId,
  workspaceId,
  actorUserId,
  actorAgentSlug,
  summary,
}: FanoutArgs): Promise<void> {
  if (!mentions || mentions.length === 0) return

  const userMentions = mentions.filter((m) => m.kind === "user")
  if (userMentions.length === 0) return

  // Skip self-mentions.
  const recipients = userMentions.filter((m) => m.id !== actorUserId)
  if (recipients.length === 0) return

  // createMany avoids N round-trips; skipDuplicates doesn't apply here because
  // there's no unique constraint, so we do a cheap pre-check for existing
  // mention items on the same ref to avoid obvious double-fires.
  const existing = await prisma.inboxItem.findMany({
    where: {
      workspaceId,
      refType,
      refId,
      kind: "mention",
      userId: { in: recipients.map((r) => r.id) },
    },
    select: { userId: true },
  })
  const already = new Set(existing.map((e) => e.userId))
  const toCreate = recipients.filter((r) => !already.has(r.id))
  if (toCreate.length === 0) return

  await prisma.inboxItem.createMany({
    data: toCreate.map((r) => ({
      userId: r.id,
      workspaceId,
      kind: "mention",
      refType,
      refId,
      actorUserId: actorUserId ?? null,
      actorAgentSlug: actorAgentSlug ?? null,
      summary: summary ?? null,
    })),
  })
}
