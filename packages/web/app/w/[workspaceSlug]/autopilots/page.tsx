"use client"

import { use } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import {
  useAutopilots,
  useUpdateAutopilot,
  useRunAutopilot,
} from "@/hooks/useAutopilots"
import { AutopilotCard } from "@/components/autopilots/AutopilotCard"

interface PageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default function AutopilotsListPage({ params }: PageProps) {
  const { workspaceSlug } = use(params)
  const { data: autopilots = [], isLoading, error } = useAutopilots(workspaceSlug)
  const update = useUpdateAutopilot()
  const run = useRunAutopilot()

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Autopilots</h1>
          <p className="text-sm text-muted-foreground">
            Declarative, recurring agent jobs. When a trigger fires, an issue
            is created and picked up by the agent pipeline.
          </p>
        </div>
        <Link
          href={`/w/${workspaceSlug}/autopilots/new`}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New autopilot
        </Link>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-red-500">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}
      {!isLoading && !error && autopilots.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No autopilots yet. Create one to schedule recurring agent work.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {autopilots.map((a) => (
          <li key={a.id}>
            <AutopilotCard
              autopilot={a}
              workspaceSlug={workspaceSlug}
              onToggle={(next) =>
                update.mutate({ id: a.id, patch: { enabled: next } })
              }
              onRun={() => run.mutate(a.id)}
              running={run.isPending && run.variables === a.id}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
