/**
 * Shared types for the Inbox feature — used by hooks, components, and
 * anywhere a typed InboxItem/InboxCounts helps avoid `unknown` JSON.
 */

export interface InboxItem {
  id: string
  userId: string
  workspaceId: string
  kind: string // "mention" | "assigned" | "commented" | "status_change" | "autopilot_result"
  refType: string // "issue" | "conversation" | "comment" | "message"
  refId: string
  actorUserId: string | null
  actorAgentSlug: string | null
  summary: string | null
  payload: unknown
  readAt: string | null
  createdAt: string
}

export interface InboxCounts {
  total: number
  unread: number
}

export interface InboxListResponse {
  items: InboxItem[]
  nextCursor: string | null
}

export interface ResolvedMentionDTO {
  kind: "user" | "agent"
  id: string
  handle: string
  displayName: string
}
