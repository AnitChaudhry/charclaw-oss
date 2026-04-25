"use client"

/**
 * Dialog that lets the user pick an AgentProfile and start a new 1:1
 * conversation. Fetches agents from the existing /api/agent-profiles
 * route. The parent is notified with the new conversation id so it can
 * select and navigate.
 */

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/shared/utils"
import { useCreateConversation } from "@/hooks/useConversations"
import type { AgentProfileSummary } from "@/lib/types/conversation"

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}

async function fetchAgentProfiles(): Promise<AgentProfileSummary[]> {
  const res = await fetch("/api/agent-profiles")
  if (!res.ok) return []
  const data = await res.json()
  return (data.profiles ?? []) as AgentProfileSummary[]
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: NewConversationDialogProps) {
  const [agents, setAgents] = useState<AgentProfileSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const create = useCreateConversation()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAgentProfiles()
      .then((list) => {
        if (cancelled) return
        setAgents(list)
        if (list.length && !selectedId) setSelectedId(list[0].id)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load agents")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // We intentionally re-fetch each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit() {
    if (!selectedId) return
    setError(null)
    try {
      const conv = await create.mutateAsync({
        agentProfileId: selectedId,
        title: title.trim() || undefined,
      })
      onCreated(conv.id)
      onOpenChange(false)
      setTitle("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>
            Pick an agent to start a 1:1 conversation with.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. refactor auth middleware"
              className="mt-1"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Agent
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : agents.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No agents in this workspace. Create one first on the Agent
                Profiles page.
              </div>
            ) : (
              <ul className="flex flex-col max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {agents.map((a) => {
                  const active = a.id === selectedId
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors",
                          active && "bg-accent/60"
                        )}
                      >
                        {a.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.avatarUrl}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover border border-border/40"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                            {a.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {a.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            @{a.slug}
                            {a.kind ? ` · ${a.kind}` : ""}
                          </div>
                        </div>
                        {active && (
                          <span className="text-[11px] text-primary">
                            selected
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-3 rounded-md border border-input text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!selectedId || create.isPending}
            className={cn(
              "h-9 px-3 rounded-md text-sm font-medium border",
              "bg-primary text-primary-foreground border-primary/10",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {create.isPending ? "Creating…" : "Start chat"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
