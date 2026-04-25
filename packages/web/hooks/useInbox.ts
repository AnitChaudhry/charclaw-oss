"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  InboxCounts,
  InboxItem,
  InboxListResponse,
} from "@/lib/types/inbox"

// =============================================================================
// Query keys
// =============================================================================

export const inboxQueryKeys = {
  all: ["inbox"] as const,
  list: (opts: { unread?: boolean; workspaceSlug?: string | null } = {}) =>
    [...inboxQueryKeys.all, "list", opts.unread ?? false, opts.workspaceSlug ?? null] as const,
  counts: (workspaceSlug?: string | null) =>
    [...inboxQueryKeys.all, "counts", workspaceSlug ?? null] as const,
} as const

// =============================================================================
// API helpers
// =============================================================================

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    qs.set(k, String(v))
  }
  const str = qs.toString()
  return str ? `?${str}` : ""
}

async function fetchInbox(opts: {
  unread?: boolean
  limit?: number
  cursor?: string | null
  workspaceSlug?: string | null
}): Promise<InboxListResponse> {
  const qs = buildQuery({
    unread: opts.unread ? 1 : undefined,
    limit: opts.limit ?? 50,
    cursor: opts.cursor ?? undefined,
    workspaceSlug: opts.workspaceSlug ?? undefined,
  })
  const res = await fetch(`/api/inbox${qs}`)
  if (!res.ok) throw new Error("Failed to fetch inbox")
  return res.json()
}

async function fetchInboxCounts(workspaceSlug?: string | null): Promise<InboxCounts> {
  const qs = buildQuery({ workspaceSlug: workspaceSlug ?? undefined })
  const res = await fetch(`/api/inbox/counts${qs}`)
  if (!res.ok) throw new Error("Failed to fetch inbox counts")
  return res.json()
}

async function markInboxItem(itemId: string, readAt: string | null): Promise<InboxItem> {
  const res = await fetch(`/api/inbox/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readAt }),
  })
  if (!res.ok) throw new Error("Failed to update inbox item")
  const data = await res.json()
  return data.item
}

async function markAllInboxRead(workspaceSlug?: string | null): Promise<number> {
  const res = await fetch(`/api/inbox/read-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug: workspaceSlug ?? null }),
  })
  if (!res.ok) throw new Error("Failed to mark all read")
  const data = await res.json()
  return data.updated as number
}

// =============================================================================
// Hooks
// =============================================================================

export function useInboxItems(opts: {
  unread?: boolean
  limit?: number
  workspaceSlug?: string | null
} = {}) {
  return useQuery({
    queryKey: inboxQueryKeys.list({ unread: opts.unread, workspaceSlug: opts.workspaceSlug }),
    queryFn: () => fetchInbox(opts),
  })
}

export function useInboxCounts(opts: {
  workspaceSlug?: string | null
  pollMs?: number
} = {}) {
  const { workspaceSlug, pollMs = 30_000 } = opts
  return useQuery({
    queryKey: inboxQueryKeys.counts(workspaceSlug),
    queryFn: () => fetchInboxCounts(workspaceSlug),
    refetchInterval: pollMs,
    refetchOnWindowFocus: true,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, readAt }: { itemId: string; readAt: string | null }) =>
      markInboxItem(itemId, readAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxQueryKeys.all })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workspaceSlug?: string | null) => markAllInboxRead(workspaceSlug ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxQueryKeys.all })
    },
  })
}
