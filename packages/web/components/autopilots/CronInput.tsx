"use client"

import { useMemo } from "react"
import { describeCron, nextRunAfter } from "@/lib/autopilots/cron"

interface CronInputProps {
  value: string
  timezone: string
  onChange: (next: string) => void
  disabled?: boolean
  label?: string
}

/**
 * Simple cron text input with live human-readable translation and a
 * preview of the next firing time.
 */
export function CronInput({
  value,
  timezone,
  onChange,
  disabled,
  label = "Schedule (cron)",
}: CronInputProps) {
  const { description, nextRun, error } = useMemo(() => {
    if (!value.trim()) {
      return { description: "", nextRun: null, error: null as string | null }
    }
    try {
      const desc = describeCron(value, timezone || "UTC")
      const next = nextRunAfter(value, new Date(), timezone || "UTC")
      return { description: desc, nextRun: next, error: null as string | null }
    } catch (err) {
      return {
        description: "",
        nextRun: null,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }, [value, timezone])

  const examples = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Weekdays 9am", value: "0 9 * * 1-5" },
    { label: "Every Monday 9am", value: "0 9 * * 1" },
    { label: "1st of month 8am", value: "0 8 1 * *" },
    { label: "Every 15m", value: "*/15 * * * *" },
  ]

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="0 9 * * 1"
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      />
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">
          {description}
          {nextRun && (
            <span className="ml-2 text-muted-foreground/80">
              · next: {nextRun.toISOString()}
            </span>
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Five-field cron: minute hour dom month dow
        </p>
      )}
      <div className="flex flex-wrap gap-1 pt-1">
        {examples.map((ex) => (
          <button
            key={ex.value}
            type="button"
            onClick={() => onChange(ex.value)}
            className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  )
}
