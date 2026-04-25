"use client"

import { useState } from "react"
import { CronInput } from "./CronInput"
import type {
  CreateAutopilotInput,
  AutopilotTrigger,
} from "@/lib/types/autopilot"

interface AutopilotFormProps {
  initial?: Partial<CreateAutopilotInput>
  submitLabel?: string
  onSubmit: (input: CreateAutopilotInput) => Promise<void> | void
  onCancel?: () => void
}

const TRIGGERS: AutopilotTrigger[] = ["cron", "manual"]

export function AutopilotForm({
  initial,
  submitLabel = "Create autopilot",
  onSubmit,
  onCancel,
}: AutopilotFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [trigger, setTrigger] = useState<AutopilotTrigger>(
    initial?.trigger ?? "cron"
  )
  const [schedule, setSchedule] = useState(initial?.schedule ?? "0 9 * * 1")
  const [timezone, setTimezone] = useState(initial?.timezone ?? "UTC")
  const [titleTemplate, setTitleTemplate] = useState(
    initial?.config?.titleTemplate ?? "Weekly review {date}"
  )
  const [bodyTemplate, setBodyTemplate] = useState(
    initial?.config?.bodyTemplate ??
      "## Agenda\n- Review open PRs\n- Triage new issues\n"
  )
  const [priority, setPriority] = useState<number>(
    initial?.config?.priority ?? 0
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        schedule: trigger === "cron" ? schedule.trim() : undefined,
        timezone: timezone.trim() || "UTC",
        config: {
          titleTemplate: titleTemplate.trim(),
          bodyTemplate,
          priority,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Weekly review"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Trigger</label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as AutopilotTrigger)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="UTC"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {trigger === "cron" && (
        <CronInput
          value={schedule}
          timezone={timezone}
          onChange={setSchedule}
        />
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Issue template
        </h3>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Title</label>
          <input
            type="text"
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            required
            placeholder="Weekly review {date}"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            Supported tokens: {"{date}"}, {"{time}"}, {"{datetime}"},{" "}
            {"{autopilotName}"}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Body</label>
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Priority
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) || 0)}
            className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
