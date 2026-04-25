"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { cn } from "@/lib/shared/utils"
import { IssueCard } from "./IssueCard"
import { CreateIssueDialog } from "./CreateIssueDialog"
import { useIssues } from "@/hooks/use-issues"
import type { Issue, IssueStatus } from "@/lib/shared/types"

// =============================================================================
// Column config
// =============================================================================

interface ColumnConfig {
  id: IssueStatus | "all_active"
  label: string
  statuses: IssueStatus[]
  emptyText: string
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "backlog",
    label: "Backlog",
    statuses: ["backlog"],
    emptyText: "No backlog items",
  },
  {
    id: "all_active",
    label: "In Progress",
    statuses: ["claimed", "in_progress", "blocked"],
    emptyText: "No active work",
  },
  {
    id: "done",
    label: "Done",
    statuses: ["done", "failed"],
    emptyText: "No completed issues",
  },
]

// =============================================================================
// IssueDetailSheet — inline slide-over for issue details
// =============================================================================

interface IssueDetailProps {
  issue: Issue | null
  onClose: () => void
  onStatusChange: (issueId: string, status: IssueStatus) => void
  isUpdating: boolean
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "backlog",     label: "Backlog" },
  { value: "claimed",     label: "Claimed" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked",     label: "Blocked" },
  { value: "done",        label: "Done" },
  { value: "failed",      label: "Failed" },
]

function IssueDetail({ issue, onClose, onStatusChange, isUpdating }: IssueDetailProps) {
  if (!issue) return null

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-foreground">Issue details</span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground leading-snug">{issue.title}</h2>

        {issue.body && (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">{issue.body}</p>
        )}

        {/* Status selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</span>
          <select
            value={issue.status}
            disabled={isUpdating}
            onChange={(e) => onStatusChange(issue.id, e.target.value as IssueStatus)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        {issue.assigneeAgent && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Assigned to</span>
            <div className="flex items-center gap-2 text-xs text-foreground">
              {issue.assigneeAgent.avatarUrl ? (
                <img src={issue.assigneeAgent.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold">
                  {issue.assigneeAgent.name[0]}
                </span>
              )}
              {issue.assigneeAgent.name}
            </div>
          </div>
        )}

        {/* Comments */}
        {issue.comments && issue.comments.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Activity</span>
            {issue.comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-medium text-foreground">
                    {c.authorAgent ?? "user"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// IssueBoard
// =============================================================================

interface IssueBoardProps {
  onRegisterOpenNew?: (fn: () => void) => void
}

export function IssueBoard({ onRegisterOpenNew }: IssueBoardProps) {
  const { issues, isLoading, error, createIssue, updateIssue, isCreating, isUpdating } = useIssues()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  // Let the page register a handler to open the create dialog from Electron tray
  useEffect(() => {
    onRegisterOpenNew?.(() => setCreateOpen(true))
  }, [onRegisterOpenNew])

  const handleStatusChange = useCallback(async (issueId: string, status: IssueStatus) => {
    await updateIssue({ issueId, status })
    setSelectedIssue((prev) => prev?.id === issueId ? { ...prev, status } : prev)
  }, [updateIssue])

  const handleIssueCreated = useCallback((issue: Issue) => {
    setCreateOpen(false)
    setSelectedIssue(issue)
  }, [])

  const handleCardClick = useCallback((issue: Issue) => {
    setSelectedIssue((prev) => prev?.id === issue.id ? null : issue)
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Failed to load issues.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">Issue Board</span>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New issue
          </button>
        </div>
      </div>

      {/* Board body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Columns */}
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {COLUMNS.map((col) => {
            const colIssues = issues.filter((i) => col.statuses.includes(i.status as IssueStatus))
            return (
              <div
                key={col.id}
                className="flex min-w-[220px] max-w-[280px] flex-1 flex-col gap-2"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {col.label}
                  </span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {colIssues.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {colIssues.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11px] text-muted-foreground/60">
                      {col.emptyText}
                    </p>
                  ) : (
                    colIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onClick={handleCardClick}
                        className={cn(selectedIssue?.id === issue.id && "ring-2 ring-primary")}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        {selectedIssue && (
          <div className="w-[320px] shrink-0">
            <IssueDetail
              issue={selectedIssue}
              onClose={() => setSelectedIssue(null)}
              onStatusChange={handleStatusChange}
              isUpdating={isUpdating}
            />
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleIssueCreated}
        isCreating={isCreating}
        onCreate={createIssue}
      />
    </div>
  )
}
