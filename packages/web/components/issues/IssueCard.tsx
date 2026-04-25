"use client"

import { cn } from "@/lib/shared/utils"
import type { Issue, IssueStatus } from "@/lib/shared/types"
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle, Bot } from "lucide-react"

// =============================================================================
// Status badge
// =============================================================================

const STATUS_CONFIG: Record<IssueStatus, { label: string; icon: React.FC<{ className?: string }>; className: string }> = {
  backlog:     { label: "Backlog",     icon: Clock,         className: "text-muted-foreground" },
  claimed:     { label: "Claimed",     icon: Bot,           className: "text-blue-500" },
  in_progress: { label: "In progress", icon: Loader2,       className: "text-amber-500" },
  blocked:     { label: "Blocked",     icon: AlertCircle,   className: "text-orange-500" },
  done:        { label: "Done",        icon: CheckCircle2,  className: "text-green-500" },
  failed:      { label: "Failed",      icon: XCircle,       className: "text-destructive" },
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-medium", cfg.className)}>
      <Icon className={cn("h-3 w-3", status === "in_progress" && "animate-spin")} />
      {cfg.label}
    </span>
  )
}

// =============================================================================
// Priority dot
// =============================================================================

function PriorityDot({ priority }: { priority: number }) {
  if (priority === 0) return null
  const color = priority >= 3 ? "bg-destructive" : priority === 2 ? "bg-orange-500" : "bg-amber-400"
  return <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color)} title={`Priority ${priority}`} />
}

// =============================================================================
// IssueCard
// =============================================================================

export interface IssueCardProps {
  issue: Issue
  onClick?: (issue: Issue) => void
  onStatusChange?: (issue: Issue, status: IssueStatus) => void
  className?: string
}

export function IssueCard({ issue, onClick, className }: IssueCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(issue)}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(issue)}
      className={cn(
        "group flex cursor-pointer flex-col gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {/* Top row: priority + title */}
      <div className="flex items-start gap-1.5">
        <PriorityDot priority={issue.priority} />
        <p className="flex-1 text-xs font-medium leading-snug text-foreground line-clamp-2">
          {issue.title}
        </p>
      </div>

      {/* Bottom row: status + agent */}
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={issue.status as IssueStatus} />
        {issue.assigneeAgent && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {issue.assigneeAgent.avatarUrl ? (
              <img src={issue.assigneeAgent.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
            {issue.assigneeAgent.name}
          </span>
        )}
      </div>

      {/* Comment count */}
      {issue._count && issue._count.comments > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {issue._count.comments} comment{issue._count.comments !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
