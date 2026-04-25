"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  CreateProjectInput,
  ProjectWithCounts,
  UpdateProjectInput,
} from "@/lib/types/project"

// =============================================================================
// Query keys
// =============================================================================

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: (workspaceSlug: string | undefined, includeArchived = false) =>
    [...projectQueryKeys.all, "list", workspaceSlug ?? "active", includeArchived] as const,
  detail: (workspaceSlug: string | undefined, projectSlug: string) =>
    [...projectQueryKeys.all, "detail", workspaceSlug ?? "active", projectSlug] as const,
} as const

// =============================================================================
// API helpers
// =============================================================================

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  )
  if (entries.length === 0) return ""
  const qs = new URLSearchParams(entries as [string, string][]).toString()
  return `?${qs}`
}

async function fetchProjects(
  workspaceSlug: string | undefined,
  includeArchived: boolean
): Promise<ProjectWithCounts[]> {
  const q = buildQuery({
    workspaceSlug,
    includeArchived: includeArchived ? "1" : undefined,
  })
  const res = await fetch(`/api/projects${q}`)
  if (!res.ok) throw new Error("Failed to fetch projects")
  const data = await res.json()
  return data.projects ?? []
}

async function fetchProject(
  workspaceSlug: string | undefined,
  projectSlug: string
): Promise<ProjectWithCounts> {
  const q = buildQuery({ workspaceSlug })
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectSlug)}${q}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to fetch project")
  }
  const data = await res.json()
  return data.project
}

async function createProject(
  input: CreateProjectInput
): Promise<ProjectWithCounts> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to create project")
  }
  const data = await res.json()
  return data.project
}

interface UpdateProjectArgs {
  workspaceSlug?: string
  projectSlug: string
  patch: UpdateProjectInput
}

async function updateProject({
  workspaceSlug,
  projectSlug,
  patch,
}: UpdateProjectArgs): Promise<ProjectWithCounts> {
  const q = buildQuery({ workspaceSlug })
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectSlug)}${q}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, workspaceSlug }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to update project")
  }
  const data = await res.json()
  return data.project
}

interface ArchiveProjectArgs {
  workspaceSlug?: string
  projectSlug: string
  hard?: boolean
}

async function archiveProject({
  workspaceSlug,
  projectSlug,
  hard,
}: ArchiveProjectArgs): Promise<void> {
  const q = buildQuery({
    workspaceSlug,
    hard: hard ? "1" : undefined,
  })
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectSlug)}${q}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to archive project")
  }
}

// =============================================================================
// Hooks
// =============================================================================

export function useProjects(
  workspaceSlug?: string,
  options?: { includeArchived?: boolean }
) {
  const includeArchived = options?.includeArchived ?? false
  return useQuery({
    queryKey: projectQueryKeys.list(workspaceSlug, includeArchived),
    queryFn: () => fetchProjects(workspaceSlug, includeArchived),
  })
}

export function useProject(
  workspaceSlug: string | undefined,
  projectSlug: string
) {
  return useQuery({
    queryKey: projectQueryKeys.detail(workspaceSlug, projectSlug),
    queryFn: () => fetchProject(workspaceSlug, projectSlug),
    enabled: Boolean(projectSlug),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectQueryKeys.all })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectQueryKeys.all })
    },
  })
}

export function useArchiveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: archiveProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectQueryKeys.all })
    },
  })
}
