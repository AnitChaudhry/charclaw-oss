"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import type { Issue, IssueStatus, AgentProfileSummary } from "@/lib/shared/types"

// =============================================================================
// API helpers
// =============================================================================

async function fetchIssues(status?: string): Promise<Issue[]> {
  const url = status ? `/api/issues?status=${encodeURIComponent(status)}` : "/api/issues"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch issues")
  const data = await res.json()
  return data.issues
}

async function fetchAgentProfiles(): Promise<AgentProfileSummary[]> {
  const res = await fetch("/api/agent-profiles")
  if (!res.ok) return []
  const data = await res.json()
  return data.profiles
}

interface CreateIssueInput {
  title: string
  body?: string
  priority?: number
  assigneeAgentId?: string
}

async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const res = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to create issue")
  }
  const data = await res.json()
  return data.issue
}

interface UpdateIssueInput {
  issueId: string
  status?: IssueStatus
  title?: string
  body?: string
  priority?: number
  assigneeAgentId?: string | null
}

async function updateIssue({ issueId, ...patch }: UpdateIssueInput): Promise<Issue> {
  const res = await fetch(`/api/issues/${issueId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error("Failed to update issue")
  const data = await res.json()
  return data.issue
}

// =============================================================================
// Hooks
// =============================================================================

export interface UseIssues {
  issues: Issue[]
  isLoading: boolean
  error: Error | null
  createIssue: (input: CreateIssueInput) => Promise<Issue>
  updateIssue: (input: UpdateIssueInput) => Promise<Issue>
  isCreating: boolean
  isUpdating: boolean
}

export function useIssues(statusFilter?: string): UseIssues {
  const qc = useQueryClient()

  const { data: issues = [], isLoading, error } = useQuery({
    queryKey: queryKeys.issues.list(statusFilter),
    queryFn: () => fetchIssues(statusFilter),
  })

  const createMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })

  return {
    issues,
    isLoading,
    error: error as Error | null,
    createIssue: createMutation.mutateAsync,
    updateIssue: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  }
}

export function useAgentProfiles() {
  return useQuery({
    queryKey: queryKeys.agentProfiles.list(),
    queryFn: fetchAgentProfiles,
  })
}
