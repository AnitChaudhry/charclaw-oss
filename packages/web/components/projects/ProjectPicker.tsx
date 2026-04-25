"use client"

import { useState } from "react"
import { Check, ChevronDown, FolderKanban, Loader2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/shared/utils"
import { useProjects } from "@/hooks/useProjects"
import { useQueryClient } from "@tanstack/react-query"
import { projectQueryKeys } from "@/hooks/useProjects"

interface ProjectPickerProps {
  issueId: string
  currentProjectId: string | null
  /** Called after the server confirms the assignment. */
  onChange?: (projectId: string | null) => void
  /** Optional: scope the list to a specific workspace. */
  workspaceSlug?: string
  className?: string
}

function ColorDot({ color }: { color: string | null }) {
  const looksHex = color && /^#[0-9a-fA-F]{3,8}$/.test(color)
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        !looksHex && "bg-muted-foreground/40"
      )}
      style={looksHex ? { backgroundColor: color! } : undefined}
    />
  )
}

/**
 * Small dropdown used on an issue row/detail pane to (un)assign a project.
 * Does not modify the existing /api/issues/** routes — instead calls the
 * new /api/issues/assign-project helper.
 */
export function ProjectPicker({
  issueId,
  currentProjectId,
  onChange,
  workspaceSlug,
  className,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: projects = [], isLoading } = useProjects(workspaceSlug)
  const current = projects.find((p) => p.id === currentProjectId) ?? null

  async function assign(projectId: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/issues/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, projectId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to assign project")
      }
      onChange?.(projectId)
      // Invalidate project lists so issue counts refresh.
      qc.invalidateQueries({ queryKey: projectQueryKeys.all })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : current ? (
              <ColorDot color={current.color} />
            ) : (
              <FolderKanban className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-left">
              {current ? current.name : "No project"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuItem
            onClick={() => assign(null)}
            className="text-xs"
          >
            <X className="h-3 w-3" />
            <span className="flex-1">No project</span>
            {currentProjectId === null && <Check className="h-3 w-3" />}
          </DropdownMenuItem>

          {projects.length > 0 && <DropdownMenuSeparator />}

          {isLoading && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Loading…
            </div>
          )}

          {projects
            .filter((p) => p.archivedAt === null)
            .map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => assign(p.id)}
                className="text-xs"
              >
                <ColorDot color={p.color} />
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === currentProjectId && <Check className="h-3 w-3" />}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  )
}
