"use client"

import Link from "next/link"
import { describeCron } from "@/lib/autopilots/cron"
import type { Autopilot } from "@/lib/types/autopilot"
import { Play, Clock } from "lucide-react"

interface AutopilotCardProps {
  autopilot: Autopilot
  workspaceSlug: string
  onToggle: (next: boolean) => void
  onRun: () => void
  running?: boolean
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  if (mins < 1) return diff >= 0 ? "moments" : "just now"
  if (mins < 60) return diff >= 0 ? `in ${mins}m` : `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  return diff >= 0 ? `in ${days}d` : `${days}d ago`
}

export function AutopilotCard({
  autopilot,
  workspaceSlug,
  onToggle,
  onRun,
  running,
}: AutopilotCardProps) {
  const triggerLabel =
    autopilot.trigger === "cron"
      ? autopilot.schedule
        ? describeCron(autopilot.schedule, autopilot.timezone)
        : "cron (no schedule)"
      : autopilot.trigger

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/w/${workspaceSlug}/autopilots/${autopilot.id}`}
            className="truncate text-sm font-semibold text-foreground hover:underline"
          >
            {autopilot.name}
          </Link>
          {autopilot.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {autopilot.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {triggerLabel}
            </span>
            <span>last: {formatRelative(autopilot.lastRunAt)}</span>
            <span>next: {formatRelative(autopilot.nextRunAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> Run
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autopilot.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4"
            />
            {autopilot.enabled ? "Enabled" : "Paused"}
          </label>
        </div>
      </div>
    </div>
  )
}
