"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Autopilot,
  AutopilotRun,
  CreateAutopilotInput,
  UpdateAutopilotInput,
} from "@/lib/types/autopilot"

// =============================================================================
// Query keys — kept local so we don't need to touch the shared factory.
// =============================================================================
export const autopilotKeys = {
  all: ["autopilots"] as const,
  list: (workspaceSlug?: string) =>
    ["autopilots", "list", workspaceSlug ?? "active"] as const,
  detail: (id: string) => ["autopilots", "detail", id] as const,
  runs: (id: string) => ["autopilots", "runs", id] as const,
}

// =============================================================================
// Fetchers
// =============================================================================

async function fetchAutopilots(workspaceSlug?: string): Promise<Autopilot[]> {
  const qs = workspaceSlug
    ? `?workspaceSlug=${encodeURIComponent(workspaceSlug)}`
    : ""
  const res = await fetch(`/api/autopilots${qs}`)
  if (!res.ok) throw new Error("Failed to fetch autopilots")
  const data = await res.json()
  return data.autopilots
}

async function fetchAutopilot(id: string): Promise<Autopilot> {
  const res = await fetch(`/api/autopilots/${id}`)
  if (!res.ok) throw new Error("Failed to fetch autopilot")
  const data = await res.json()
  return data.autopilot
}

async function fetchRuns(id: string, limit = 50): Promise<AutopilotRun[]> {
  const res = await fetch(`/api/autopilots/${id}/runs?limit=${limit}`)
  if (!res.ok) throw new Error("Failed to fetch runs")
  const data = await res.json()
  return data.runs
}

async function createAutopilot(input: CreateAutopilotInput): Promise<Autopilot> {
  const res = await fetch("/api/autopilots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to create autopilot")
  }
  const data = await res.json()
  return data.autopilot
}

async function updateAutopilot({
  id,
  patch,
}: {
  id: string
  patch: UpdateAutopilotInput
}): Promise<Autopilot> {
  const res = await fetch(`/api/autopilots/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to update autopilot")
  }
  const data = await res.json()
  return data.autopilot
}

async function deleteAutopilot(id: string): Promise<void> {
  const res = await fetch(`/api/autopilots/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete autopilot")
}

async function runAutopilot(id: string): Promise<{ run: AutopilotRun; autopilot: Autopilot }> {
  const res = await fetch(`/api/autopilots/${id}/run`, { method: "POST" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.result?.error ?? data?.error ?? "Failed to run autopilot")
  }
  return { run: data.run, autopilot: data.autopilot }
}

// =============================================================================
// Hooks
// =============================================================================

export function useAutopilots(workspaceSlug?: string) {
  return useQuery({
    queryKey: autopilotKeys.list(workspaceSlug),
    queryFn: () => fetchAutopilots(workspaceSlug),
  })
}

export function useAutopilot(id: string | undefined) {
  return useQuery({
    queryKey: id ? autopilotKeys.detail(id) : ["autopilots", "detail", "none"],
    queryFn: () => {
      if (!id) throw new Error("id required")
      return fetchAutopilot(id)
    },
    enabled: Boolean(id),
  })
}

export function useAutopilotRuns(id: string | undefined, limit = 50) {
  return useQuery({
    queryKey: id ? autopilotKeys.runs(id) : ["autopilots", "runs", "none"],
    queryFn: () => {
      if (!id) throw new Error("id required")
      return fetchRuns(id, limit)
    },
    enabled: Boolean(id),
  })
}

export function useCreateAutopilot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAutopilot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autopilotKeys.all })
    },
  })
}

export function useUpdateAutopilot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAutopilot,
    onSuccess: (autopilot) => {
      qc.invalidateQueries({ queryKey: autopilotKeys.all })
      qc.setQueryData(autopilotKeys.detail(autopilot.id), autopilot)
    },
  })
}

export function useDeleteAutopilot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAutopilot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autopilotKeys.all })
    },
  })
}

export function useRunAutopilot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: runAutopilot,
    onSuccess: ({ autopilot }) => {
      qc.invalidateQueries({ queryKey: autopilotKeys.all })
      qc.invalidateQueries({ queryKey: autopilotKeys.runs(autopilot.id) })
      qc.setQueryData(autopilotKeys.detail(autopilot.id), autopilot)
    },
  })
}
