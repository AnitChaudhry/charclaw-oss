"use client"

import { use } from "react"
import { InboxList } from "@/components/inbox/InboxList"
import { useMarkAllRead, useInboxCounts } from "@/hooks/useInbox"

interface Params {
  workspaceSlug: string
}

export default function InboxPage({ params }: { params: Promise<Params> }) {
  const { workspaceSlug } = use(params)
  const countsQuery = useInboxCounts({ workspaceSlug })
  const markAllRead = useMarkAllRead()

  const unread = countsQuery.data?.unread ?? 0

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "No unread notifications"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllRead.mutate(workspaceSlug)}
          disabled={unread === 0 || markAllRead.isPending}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>
      <InboxList workspaceSlug={workspaceSlug} limit={50} />
    </div>
  )
}
