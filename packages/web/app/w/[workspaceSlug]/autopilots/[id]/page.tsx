"use client"

import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Play, Trash2 } from "lucide-react"
import {
  useAutopilot,
  useAutopilotRuns,
  useDeleteAutopilot,
  useRunAutopilot,
  useUpdateAutopilot,
} from "@/hooks/useAutopilots"
import { AutopilotRunsList } from "@/components/autopilots/AutopilotRunsList"
import { describeCron } from "@/lib/autopilots/cron"

interface PageProps {
  params: Promise<{ workspaceSlug: string; id: string }>
}

export default function AutopilotDetailPage({ params }: PageProps) {
  const { workspaceSlug, id } = use(params)
  const router = useRouter()
  const { data: autopilot, isLoading, error } = useAutopilot(id)
  const { data: runs = [], isLoading: runsLoading } = useAutopilotRuns(id)
  const update = useUpdateAutopilot()
  const del = useDeleteAutopilot()
  const run = useRunAutopilot()

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }
  if (error || !autopilot) {
    return (
      <div className="p-6 text-sm text-red-500">
        {error instanceof Error ? error.message : "Autopilot not found"}
      </div>
    )
  }

  const scheduleLabel =
    autopilot.trigger === "cron" && autopilot.schedule
      ? describeCron(autopilot.schedule, autopilot.timezone)
      : autopilot.trigger

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href={`/w/${workspaceSlug}/autopilots`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to autopilots
        </Link>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {autopilot.name}
          </h1>
          {autopilot.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {autopilot.description}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {scheduleLabel} · last run {autopilot.lastRunAt ?? "—"} · next run{" "}
            {autopilot.nextRunAt ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run.mutate(autopilot.id)}
            disabled={run.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> Run now
          </button>
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autopilot.enabled}
              onChange={(e) =>
                update.mutate({
                  id: autopilot.id,
                  patch: { enabled: e.target.checked },
                })
              }
              className="h-4 w-4"
            />
            {autopilot.enabled ? "Enabled" : "Paused"}
          </label>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete this autopilot?")) return
              await del.mutateAsync(autopilot.id)
              router.push(`/w/${workspaceSlug}/autopilots`)
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Configuration
        </h2>
        <pre className="overflow-x-auto rounded bg-secondary/50 p-3 text-[11px] text-foreground">
          {JSON.stringify(
            {
              trigger: autopilot.trigger,
              schedule: autopilot.schedule,
              timezone: autopilot.timezone,
              agentProfileId: autopilot.agentProfileId,
              repoId: autopilot.repoId,
              config: autopilot.config,
            },
            null,
            2
          )}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Recent runs
        </h2>
        <AutopilotRunsList runs={runs} isLoading={runsLoading} />
      </section>
    </div>
  )
}
