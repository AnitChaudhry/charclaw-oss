"use client"

import { useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAgentProfiles } from "@/hooks/use-issues"
import type { Issue } from "@/lib/shared/types"

interface CreateIssueDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (issue: Issue) => void
  isCreating: boolean
  onCreate: (input: { title: string; body?: string; priority?: number; assigneeAgentId?: string }) => Promise<Issue>
}

export function CreateIssueDialog({ open, onClose, onCreated, isCreating, onCreate }: CreateIssueDialogProps) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState(0)
  const [agentId, setAgentId] = useState("")

  const { data: agents = [] } = useAgentProfiles()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const issue = await onCreate({
      title: title.trim(),
      body: body.trim() || undefined,
      priority,
      assigneeAgentId: agentId || undefined,
    })
    setTitle("")
    setBody("")
    setPriority(0)
    setAgentId("")
    onCreated(issue)
  }, [title, body, priority, agentId, onCreate, onCreated])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) onClose()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm">New issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description of the task"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detailed context for the agent…"
              rows={4}
              className="resize-none rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Priority + Agent row */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={0}>No priority</option>
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
            </div>

            {agents.length > 0 && (
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Assign to agent</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Unassigned (backlog)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="mt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {isCreating && <Loader2 className="h-3 w-3 animate-spin" />}
              Create issue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
