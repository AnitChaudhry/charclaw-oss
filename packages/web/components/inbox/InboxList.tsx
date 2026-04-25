"use client"

import { useRouter } from "next/navigation"
import { useInboxItems, useMarkRead } from "@/hooks/useInbox"
import { cn } from "@/lib/shared/utils"
import type { InboxItem } from "@/lib/types/inbox"

interface InboxListProps {
  workspaceSlug?: string | null
  limit?: number
}

function summarize(item: InboxItem): string {
  if (item.summary && item.summary.trim().length > 0) return item.summary
  if (item.kind === "mention") return `You were mentioned in ${item.refType}`
  return `${item.kind} on ${item.refType}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString()
}

/**
 * Build a link to the referenced entity. Conservative: only known refTypes
 * get a navigation target; everything else just marks read without
 * navigating. Links are workspace-scoped when possible.
 */
function hrefForItem(item: InboxItem, workspaceSlug?: string | null): string | null {
  const slug = workspaceSlug ? `/w/${workspaceSlug}` : ""
  switch (item.refType) {
    case "issue":
      // The app currently renders issues inline on the board; this anchors
      // to the board with the issue id so the page can scroll-to-hash.
      return `${slug}#issue-${item.refId}` || null
    case "conversation":
      return `${slug}/chat/${item.refId}`
    default:
      return null
  }
}

export function InboxList({ workspaceSlug, limit = 50 }: InboxListProps) {
  const { data, isLoading, error } = useInboxItems({ limit, workspaceSlug })
  const markRead = useMarkRead()
  const router = useRouter()

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
  }
  if (error) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        Failed to load inbox.
      </div>
    )
  }
  const items = data?.items ?? []
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Your inbox is empty.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {items.map((item) => {
        const isUnread = !item.readAt
        const href = hrefForItem(item, workspaceSlug)
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                if (isUnread) {
                  markRead.mutate({ itemId: item.id, readAt: new Date().toISOString() })
                }
                if (href) router.push(href)
              }}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60",
                isUnread && "bg-accent/30"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  isUnread ? "bg-primary" : "bg-muted-foreground/40"
                )}
                aria-label={isUnread ? "Unread" : "Read"}
              />
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {item.actorAgentSlug ? "A" : "U"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {summarize(item)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {item.actorAgentSlug ? `@${item.actorAgentSlug}` : "member"} ·{" "}
                  {formatTime(item.createdAt)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default InboxList
