"use client"

/**
 * Left-rail conversation list for /w/[workspaceSlug]/chat.
 *
 * Each row shows the agent avatar, title (or agent name fallback),
 * and a relative-time stamp. Parent owns selection state.
 */

import { cn } from "@/lib/shared/utils"
import type { Conversation } from "@/lib/types/conversation"
import { Plus, MessageSquare } from "lucide-react"

function shortRelative(iso: string | null | undefined): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ""
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 60) return "now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  isLoading: boolean
  onSelect: (conversation: Conversation) => void
  onNewChat: () => void
}

export function ConversationList({
  conversations,
  selectedId,
  isLoading,
  onSelect,
  onNewChat,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-background/50 w-full md:w-72 shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="text-sm font-medium">Chats</div>
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-50" />
            No chats yet. Start a conversation with an agent.
          </div>
        ) : (
          <ul className="flex flex-col">
            {conversations.map((c) => {
              const active = c.id === selectedId
              const title =
                c.title?.trim() ||
                c.agentProfile?.name ||
                "Untitled chat"
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-accent/50 transition-colors border-l-2",
                      active
                        ? "bg-accent/60 border-primary"
                        : "border-transparent"
                    )}
                  >
                    {c.agentProfile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.agentProfile.avatarUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover border border-border/40"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-medium">
                        {(c.agentProfile?.name ?? "A").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">
                          {title}
                        </div>
                        <div className="shrink-0 text-[11px] text-muted-foreground">
                          {shortRelative(c.lastMessageAt ?? c.createdAt)}
                        </div>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.agentProfile
                          ? `@${c.agentProfile.slug}`
                          : "no agent"}
                        {c.archivedAt ? " · archived" : ""}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
