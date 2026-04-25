"use client"

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
import type {
  CreatePinInput,
  IssueFilter,
  PinKind,
} from "@/lib/types/pin"
import { PIN_KINDS } from "@/lib/types/pin"
import { KindIcon, kindLabel } from "./PinItem"

interface ProjectOption {
  id: string
  name: string
  slug: string
}

export interface AddPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreatePinInput) => Promise<unknown>
  /**
   * Optional project list to populate the project picker. If not
   * provided, the dialog falls back to a manual targetRef input for
   * `project` pins.
   */
  projects?: ProjectOption[]
}

const ISSUE_STATUSES = [
  { value: "", label: "Any status" },
  { value: "backlog", label: "Backlog" },
  { value: "claimed", label: "Claimed" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
]

export function AddPinDialog({
  open,
  onOpenChange,
  onCreate,
  projects,
}: AddPinDialogProps) {
  const [kind, setKind] = useState<PinKind>("issue_filter")
  const [label, setLabel] = useState("")
  const [targetRef, setTargetRef] = useState("")
  const [status, setStatus] = useState<string>("")
  const [filterProjectId, setFilterProjectId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form whenever the dialog is re-opened.
  useEffect(() => {
    if (open) {
      setKind("issue_filter")
      setLabel("")
      setTargetRef("")
      setStatus("")
      setFilterProjectId("")
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const needsTargetRef = kind !== "issue_filter"
  const isUrl = kind === "url"
  const isProject = kind === "project"
  const canSubmit =
    !!label.trim() &&
    (kind === "issue_filter" || !!targetRef.trim()) &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const input: CreatePinInput = {
        kind,
        label: label.trim(),
      }
      if (kind === "issue_filter") {
        const filter: IssueFilter = {}
        if (status) filter.status = status
        if (filterProjectId) filter.projectId = filterProjectId
        input.filter = filter
      } else {
        input.targetRef = targetRef.trim()
      }
      await onCreate(input)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create pin")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add pin</DialogTitle>
          <DialogDescription>
            Pin a saved filter, project, chat, repo, or external link to your
            sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-medium">
              Kind
            </label>
            <div className="flex flex-wrap gap-1">
              {PIN_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                    kind === k
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input hover:bg-muted text-muted-foreground"
                  )}
                >
                  <KindIcon kind={k} className="size-3.5" />
                  {kindLabel(k)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="pin-label"
              className="text-muted-foreground mb-2 block text-xs font-medium"
            >
              Label
            </label>
            <Input
              id="pin-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My open issues"
              autoFocus
            />
          </div>

          {kind === "issue_filter" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="pin-filter-status"
                  className="text-muted-foreground mb-2 block text-xs font-medium"
                >
                  Status
                </label>
                <select
                  id="pin-filter-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s.value || "any"} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {projects && projects.length > 0 && (
                <div>
                  <label
                    htmlFor="pin-filter-project"
                    className="text-muted-foreground mb-2 block text-xs font-medium"
                  >
                    Project
                  </label>
                  <select
                    id="pin-filter-project"
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Any project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {needsTargetRef && (
            <div>
              <label
                htmlFor="pin-target-ref"
                className="text-muted-foreground mb-2 block text-xs font-medium"
              >
                {isUrl
                  ? "URL"
                  : isProject
                    ? "Project"
                    : kind === "conversation"
                      ? "Conversation id"
                      : "Repo id"}
              </label>
              {isProject && projects && projects.length > 0 ? (
                <select
                  id="pin-target-ref"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="pin-target-ref"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  placeholder={
                    isUrl ? "https://example.com" : "paste id here"
                  }
                />
              )}
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border-input hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-md px-3 py-1.5 text-sm"
          >
            {submitting ? "Saving…" : "Add pin"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
