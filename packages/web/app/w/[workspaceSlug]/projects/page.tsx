"use client"

import { useState } from "react"
import { FolderKanban, Loader2, Plus, Archive } from "lucide-react"
import { useRequiredWorkspace } from "@/components/workspace/WorkspaceProvider"
import { ProjectCard } from "@/components/projects/ProjectCard"
import { NewProjectDialog } from "@/components/projects/NewProjectDialog"
import { useProjects } from "@/hooks/useProjects"

/**
 * Projects list view — grid of ProjectCard components. Lives at
 * /w/[workspaceSlug]/projects. Also offers a toggle for archived projects.
 */
export default function ProjectsListPage() {
  const ws = useRequiredWorkspace()
  const [showArchived, setShowArchived] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: projects = [], isLoading, error } = useProjects(ws.slug, {
    includeArchived: showArchived,
  })

  return (
    <main className="flex h-full min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Projects</span>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {projects.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={
              "flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer " +
              (showArchived
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/40")
            }
          >
            <Archive className="h-3 w-3" />
            {showArchived ? "Hiding nothing" : "Show archived"}
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {error ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Failed to load projects.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No projects yet
            </p>
            <p className="max-w-sm text-xs text-muted-foreground/70">
              Projects are lightweight groupings of issues. Create one to
              organize related work.
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                workspaceSlug={ws.slug}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaceSlug={ws.slug}
      />
    </main>
  )
}
