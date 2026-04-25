"use client"

import Link from "next/link"
import { FolderKanban, Archive } from "lucide-react"
import { cn } from "@/lib/shared/utils"
import type { ProjectWithCounts } from "@/lib/types/project"

interface ProjectCardProps {
  project: ProjectWithCounts
  workspaceSlug: string
  className?: string
}

/**
 * Color dot — respects `project.color` if it looks like a hex string; falls
 * back to a muted neutral.
 */
function ColorDot({ color }: { color: string | null }) {
  const looksHex = color && /^#[0-9a-fA-F]{3,8}$/.test(color)
  return (
    <span
      aria-hidden
      className={cn(
        "h-2.5 w-2.5 rounded-full shrink-0",
        !looksHex && "bg-muted-foreground/40"
      )}
      style={looksHex ? { backgroundColor: color! } : undefined}
    />
  )
}

export function ProjectCard({
  project,
  workspaceSlug,
  className,
}: ProjectCardProps) {
  const isArchived = project.archivedAt !== null

  return (
    <Link
      href={`/w/${workspaceSlug}/projects/${project.slug}`}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/50 hover:border-ring/40",
        isArchived && "opacity-60",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <ColorDot color={project.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {project.name}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">
            {project.slug}
          </p>
        </div>
        {isArchived && (
          <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            <Archive className="h-2.5 w-2.5" />
            archived
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {project.issueCount} issue{project.issueCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground/70">
          {new Date(project.createdAt).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}
