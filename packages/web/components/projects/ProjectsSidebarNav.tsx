"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/shared/utils"
import { useProjects } from "@/hooks/useProjects"
import { NewProjectDialog } from "./NewProjectDialog"

interface ProjectsSidebarNavProps {
  workspaceSlug: string
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
 * Collapsible "Projects" sidebar section. Hits /api/projects and renders
 * links to each project under the current workspace. Also includes a
 * "New project" button that opens NewProjectDialog.
 */
export function ProjectsSidebarNav({
  workspaceSlug,
  className,
}: ProjectsSidebarNavProps) {
  const [expanded, setExpanded] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const pathname = usePathname()

  const { data: projects = [], isLoading } = useProjects(workspaceSlug)

  const activeProjects = projects.filter((p) => p.archivedAt === null)

  return (
    <nav
      className={cn("flex flex-col text-xs", className)}
      aria-label="Projects"
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Projects
          <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {activeProjects.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          title="New project"
          aria-label="New project"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Project list */}
      {expanded && (
        <div className="flex flex-col gap-0.5 px-1">
          <Link
            href={`/w/${workspaceSlug}/projects`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              pathname === `/w/${workspaceSlug}/projects` &&
                "bg-accent/60 text-foreground"
            )}
          >
            <FolderKanban className="h-3 w-3" />
            All projects
          </Link>

          {isLoading && (
            <span className="px-2 py-1 text-[10px] text-muted-foreground/70">
              Loading…
            </span>
          )}

          {!isLoading && activeProjects.length === 0 && (
            <span className="px-2 py-1 text-[10px] text-muted-foreground/70">
              No projects yet
            </span>
          )}

          {activeProjects.map((p) => {
            const href = `/w/${workspaceSlug}/projects/${p.slug}`
            const isActive = pathname === href
            return (
              <Link
                key={p.id}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
                  isActive && "bg-accent/60 text-foreground"
                )}
              >
                <ColorDot color={p.color} />
                <span className="truncate flex-1">{p.name}</span>
                {p.issueCount > 0 && (
                  <span className="font-mono text-[9px] text-muted-foreground/70">
                    {p.issueCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaceSlug={workspaceSlug}
      />
    </nav>
  )
}
