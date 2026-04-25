"use client"

import type { AutopilotRun } from "@/lib/types/autopilot"
import { CheckCircle2, XCircle, CircleDashed, MinusCircle } from "lucide-react"

interface AutopilotRunsListProps {
  runs: AutopilotRun[]
  isLoading?: boolean
}

function StatusIcon({ status }: { status: AutopilotRun["status"] }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground" />
  }
}

export function AutopilotRunsList({ runs, isLoading }: AutopilotRunsListProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading runs…</p>
    )
  }
  if (!runs.length) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {runs.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-3 py-2">
          <StatusIcon status={r.status} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground capitalize">
                {r.status}
              </span>
              <span className="text-muted-foreground">
                {new Date(r.startedAt).toLocaleString()}
              </span>
              {r.issueId && (
                <span className="truncate text-muted-foreground">
                  issue {r.issueId}
                </span>
              )}
            </div>
            {r.error && (
              <p className="mt-1 whitespace-pre-wrap text-red-500">{r.error}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
