/**
 * Pin — per-user, per-workspace saved filters and shortcuts surfaced
 * in the sidebar. Matches the Prisma `Pin` model plus a client-side
 * convenience `href` returned by the API.
 */

export type PinKind =
  | "issue_filter"
  | "project"
  | "conversation"
  | "repo"
  | "url"

export const PIN_KINDS: PinKind[] = [
  "issue_filter",
  "project",
  "conversation",
  "repo",
  "url",
]

/**
 * Saved shape of an `issue_filter` pin. All fields are optional —
 * a bare `{}` is a valid (if pointless) filter that maps to the
 * default issues view.
 */
export interface IssueFilter {
  status?: string
  assigneeAgentId?: string
  projectId?: string
  tags?: string[]
  q?: string
}

export interface Pin {
  id: string
  kind: PinKind
  label: string
  icon: string | null
  targetRef: string | null
  filter: IssueFilter | null
  position: number
  href: string
  /**
   * Optional — populated by the API when the targetRef has a slug
   * (e.g. projects). Enables slug-based `href` generation on the
   * client without re-fetching the entity.
   */
  targetSlug?: string | null
}

export interface CreatePinInput {
  kind: PinKind
  label: string
  icon?: string | null
  targetRef?: string | null
  filter?: IssueFilter | null
  position?: number
}

export interface UpdatePinInput {
  label?: string
  icon?: string | null
  filter?: IssueFilter | null
  position?: number
}

export interface ReorderPinsInput {
  order: Array<{ id: string; position: number }>
}
