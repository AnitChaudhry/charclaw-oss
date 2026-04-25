"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Archive,
  FolderKanban,
  Loader2,
} from "lucide-react"
import { useRequiredWorkspace } from "@/components/workspace/WorkspaceProvider"
import { useProject } from "@/hooks/useProjects"
import { IssueCard } from "@/components/issues/IssueCard"
import { cn } from "@/lib/shared/utils"
import type { Issue, IssueStatus } from "@/lib/shared/types"

interface PageProps {
  params: Promise<{ workspaceSlug: string; projectSlug: string }>
}

const COLUMN_STATUSES: {
  id: string
  label: string
  statuses: IssueStatus[]
}[] = [
  { id: "backlog", label: "Backlog", statuses: ["backlog"] },
  {
    id: "active",
    label: "In Progress",
    statuses: ["claimed", "in_progress", "blocked"],
  },
  { id: "done", label: "Done", statuses: ["done", "failed"] },
]

function ColorDot({ color }: { color: string | null }) {
  const looksHex = color && /^#[0-9a-fA-F]{3,8}$/.test(color)
  return (
    <span
      aria-hidden
      className={cn(
        "h-3 w-3 rounded-full shrink-0",
        !looksHex && "bg-muted-foreground/40"
      )}
      style={looksHex ? { backgroundColor: color! } : undefined}
    />
  )
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { projectSlug } = use(params)
  const ws = useRequiredWorkspace()

  const {
    data: project,
    isLoading: loadingProject,
    error: projectError,
  } = useProject(ws.slug, projectSlug)

  const {
    data: issues = [],
    isLoading: loadingIssues,
    error: issuesError,
  } = useQuery({
    queryKey: ["projects", "issues", ws.slug, projectSlug],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/issues?workspaceSlug=${encodeURIComponent(ws.slug)}`
      )
      if (!res.ok) throw new Error("Failed to fetch project issues")
      const data = await res.json()
      return (data.issues ?? []) as Issue[]
    },
    enabled: Boolean(project),
  })

  const columns = useMemo(() => {
    return COLUMN_STATUSES.map((col) => ({
      ...col,
      issues: issues.filter((i) =>
        col.statuses.includes(i.status as IssueStatus)
      ),
    }))
  }, [issues])

  if (loadingProject) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (projectError || !project) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link
          href={`/w/${ws.slug}/projects`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to projects
        </Link>
      </main>
    )
  }

  const isArchived = project.archivedAt !== null

  return (
    <main className="flex h-full min-h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
        <Link
          href={`/w/${ws.slug}/projects`}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>

        <div className="flex items-start gap-3">
          <div className="mt-1">
            <ColorDot color={project.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-base font-semibold text-foreground">
                {project.name}
              </h1>
              <span className="font-mono text-[11px] text-muted-foreground">
                {project.slug}
              </span>
              {isArchived && (
                <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Archive className="h-2.5 w-2.5" />
                  archived
                </span>
              )}
            </div>
            {project.description && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {project.issueCount} issue
              {project.issueCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {/* Issues body */}
      <div className="flex-1 overflow-hidden">
        {issuesError ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Failed to load issues.
          </div>
        ) : loadingIssues ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : issues.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No issues in this project
            </p>
            <p className="max-w-sm text-xs text-muted-foreground/70">
              Use the project picker on an existing issue to assign it here.
            </p>
          </div>
        ) : (
          <div className="flex h-full gap-3 overflow-x-auto p-4">
            {columns.map((col) => (
              <div
                key={col.id}
                className="flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-2"
              >
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {col.issues.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {col.issues.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11px] text-muted-foreground/60">
                      Nothing here
                    </p>
                  ) : (
                    col.issues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
