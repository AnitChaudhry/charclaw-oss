"use client"

/**
 * Collapsible "Chat" section for the left sidebar. Shows recent
 * conversations with links to /w/[workspaceSlug]/chat/[conversationId].
 *
 * The enclosing sidebar will mount this — this file only exports the
 * default component to keep the sidebar itself untouched.
 */

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, MessageSquare, Plus } from "lucide-react"
import { cn } from "@/lib/shared/utils"
import { useConversations } from "@/hooks/useConversations"
import { useWorkspace } from "@/components/workspace/WorkspaceProvider"

interface ChatSidebarNavProps {
  activeConversationId?: string | null
  limit?: number
  defaultOpen?: boolean
}

export default function ChatSidebarNav({
  activeConversationId,
  limit = 8,
  defaultOpen = true,
}: ChatSidebarNavProps) {
  const [open, setOpen] = useState(defaultOpen)
  const workspace = useWorkspace()
  const { data: conversations = [], isLoading } = useConversations()

  const slug = workspace?.slug
  const recent = conversations
    .filter((c) => !c.archivedAt)
    .slice(0, limit)

  if (!slug) return null

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Chat
        </span>
        <Link
          href={`/w/${slug}/chat`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded hover:text-foreground"
          title="Open chats"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      </button>
      {open && (
        <div className="flex flex-col">
          {isLoading ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              Loading…
            </div>
          ) : recent.length === 0 ? (
            <Link
              href={`/w/${slug}/chat`}
              className="px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              No chats yet — start one
            </Link>
          ) : (
            <ul className="flex flex-col">
              {recent.map((c) => {
                const active = c.id === activeConversationId
                const title =
                  c.title?.trim() || c.agentProfile?.name || "Untitled"
                return (
                  <li key={c.id}>
                    <Link
                      href={`/w/${slug}/chat/${c.id}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50",
                        active && "bg-accent/70 text-foreground"
                      )}
                    >
                      {c.agentProfile?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.agentProfile.avatarUrl}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover border border-border/40"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                          {(c.agentProfile?.name ?? "A")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
