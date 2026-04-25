"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useInboxCounts, useInboxItems, useMarkAllRead, useMarkRead } from "@/hooks/useInbox"
import { cn } from "@/lib/shared/utils"
import type { InboxItem } from "@/lib/types/inbox"

interface InboxBellProps {
  workspaceSlug?: string | null
  /** When provided, the "See all" link uses this slug. */
  className?: string
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ""
  const diff = Date.now() - d
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const dd = Math.floor(h / 24)
  return `${dd}d`
}

function summarize(item: InboxItem): string {
  if (item.summary && item.summary.trim().length > 0) return item.summary
  if (item.kind === "mention") return `You were mentioned in ${item.refType}`
  return `${item.kind} on ${item.refType}`
}

/**
 * Header bell icon with unread badge. Polls `/api/inbox/counts` every 30s.
 * Clicking opens a popover with the last ~10 items and a "See all" link to
 * `/w/{slug}/inbox`. Wire this component into the header wherever the app
 * renders its top bar — this component intentionally does not touch the
 * sidebar.
 */
export function InboxBell({ workspaceSlug, className }: InboxBellProps) {
  const countsQuery = useInboxCounts({ workspaceSlug })
  const itemsQuery = useInboxItems({ limit: 10, workspaceSlug })
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unread = countsQuery.data?.unread ?? 0
  const items = itemsQuery.data?.items ?? []

  const seeAllHref = workspaceSlug ? `/w/${workspaceSlug}/inbox` : "#"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Inbox${unread > 0 ? `, ${unread} unread` : ""}`}
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Inbox</span>
          <button
            type="button"
            onClick={() => markAllRead.mutate(workspaceSlug ?? null)}
            disabled={unread === 0 || markAllRead.isPending}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {itemsQuery.isLoading ? "Loading…" : "You're all caught up."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const isUnread = !item.readAt
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        markRead.mutate({
                          itemId: item.id,
                          readAt: isUnread ? new Date().toISOString() : null,
                        })
                      }
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/60",
                        isUnread && "bg-accent/30"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          isUnread ? "bg-primary" : "bg-transparent"
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {summarize(item)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {item.actorAgentSlug ? `@${item.actorAgentSlug}` : "user"} · {timeAgo(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <Link href={seeAllHref} className="text-xs text-primary hover:underline">
            See all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default InboxBell
