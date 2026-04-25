"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreateProject } from "@/hooks/useProjects"
import type { ProjectWithCounts } from "@/lib/types/project"

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
  workspaceSlug: string
  onCreated?: (project: ProjectWithCounts) => void
}

const COLOR_PALETTE: { value: string; label: string }[] = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
  { value: "#a855f7", label: "Purple" },
  { value: "#64748b", label: "Slate" },
]

/** Very permissive slug generator — trims invalid characters, collapses runs. */
function autoSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 49)
}

export function NewProjectDialog({
  open,
  onClose,
  workspaceSlug,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [color, setColor] = useState<string>(COLOR_PALETTE[0]!.value)
  const [icon, setIcon] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { mutateAsync, isPending } = useCreateProject()

  // Auto-generate slug from name until the user edits the slug manually.
  useEffect(() => {
    if (!slugTouched) {
      setSlug(autoSlug(name))
    }
  }, [name, slugTouched])

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      /^[a-z0-9][a-z0-9-]{0,48}$/.test(slug) &&
      !isPending
    )
  }, [name, slug, isPending])

  const reset = useCallback(() => {
    setName("")
    setSlug("")
    setSlugTouched(false)
    setDescription("")
    setColor(COLOR_PALETTE[0]!.value)
    setIcon("")
    setError(null)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (!canSubmit) return
      try {
        const project = await mutateAsync({
          name: name.trim(),
          slug,
          description: description.trim() || undefined,
          color,
          icon: icon.trim() || undefined,
          workspaceSlug,
        })
        onCreated?.(project)
        reset()
        onClose()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create project"
        )
      }
    },
    [
      canSubmit,
      color,
      description,
      icon,
      mutateAsync,
      name,
      onClose,
      onCreated,
      reset,
      slug,
      workspaceSlug,
    ]
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        reset()
        onClose()
      }
    },
    [onClose, reset]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm">New project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Growth experiments"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              Slug <span className="text-muted-foreground">(URL)</span>
            </label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
              placeholder="growth-experiments"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Lowercase letters, digits and hyphens. Max 49 chars.
            </p>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project for?"
              rows={3}
              className="resize-none rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Color + Icon row */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={color === c.value}
                    className={
                      "h-6 w-6 rounded-full border transition-transform focus:outline-none focus:ring-2 focus:ring-ring" +
                      (color === c.value
                        ? " scale-110 border-foreground"
                        : " border-border hover:scale-105")
                    }
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-foreground">
                Icon <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="rocket or 🚀"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-destructive">{error}</p>
          )}

          <DialogFooter className="mt-1">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Create project
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
