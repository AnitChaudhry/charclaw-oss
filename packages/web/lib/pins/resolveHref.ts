/**
 * resolveHref — turn a Pin into the in-app (or external) URL it links to.
 *
 * Used both on the server (to precompute `href` in API responses) and on
 * the client (optimistic updates / preview). `workspaceSlug` is required
 * for every in-app kind except `url`, which stores an absolute URL in
 * `targetRef`.
 */
import type { IssueFilter, PinKind } from "@/lib/types/pin"

export interface PinLike {
  kind: PinKind | string
  targetRef?: string | null
  targetSlug?: string | null
  filter?: IssueFilter | null
}

/**
 * Build a querystring from an issue filter, dropping empty values.
 * Arrays are serialized as repeated keys (`tags=a&tags=b`).
 */
function issueFilterToQs(filter: IssueFilter | null | undefined): string {
  if (!filter) return ""
  const params = new URLSearchParams()
  if (filter.status) params.set("status", filter.status)
  if (filter.assigneeAgentId) params.set("assigneeAgentId", filter.assigneeAgentId)
  if (filter.projectId) params.set("projectId", filter.projectId)
  if (filter.q) params.set("q", filter.q)
  if (filter.tags && filter.tags.length > 0) {
    for (const t of filter.tags) params.append("tags", t)
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

/**
 * Very small guard — we only allow http(s) URLs for `url` pins. If a
 * stored pin violates this (e.g. schema change), we fall back to `#`
 * rather than blindly following whatever string is in the DB.
 */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function resolveHref(pin: PinLike, workspaceSlug: string): string {
  const base = `/w/${workspaceSlug}`
  switch (pin.kind) {
    case "issue_filter":
      return `${base}/${issueFilterToQs(pin.filter)}`
    case "project": {
      const key = pin.targetSlug || pin.targetRef
      return key ? `${base}/projects/${key}` : `${base}/projects`
    }
    case "conversation":
      return pin.targetRef
        ? `${base}/chat/${pin.targetRef}`
        : `${base}/chat`
    case "repo":
      return pin.targetRef ? `${base}/?repo=${pin.targetRef}` : base
    case "url":
      return isSafeExternalUrl(pin.targetRef) ? (pin.targetRef as string) : "#"
    default:
      return base
  }
}
