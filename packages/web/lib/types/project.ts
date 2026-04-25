/**
 * Shared Project types for the Projects feature.
 *
 * A Project is a lightweight grouping of Issues inside a Workspace — similar
 * in spirit to Linear projects or similar product boards. It does NOT own the
 * issues (Issue.projectId is nullable and SetNull on delete); projects can be
 * archived (soft delete) or hard-deleted.
 */

export interface Project {
  id: string
  workspaceId: string
  slug: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Project with the computed issue count. Returned from list and detail
 * endpoints so the UI can render badges without a second round-trip.
 */
export interface ProjectWithCounts extends Project {
  issueCount: number
}

/**
 * Shape accepted by `POST /api/projects`. Server validates slug regex and
 * uniqueness within workspace.
 */
export interface CreateProjectInput {
  name: string
  slug: string
  description?: string
  color?: string
  icon?: string
  workspaceId?: string
  workspaceSlug?: string
}

/**
 * Shape accepted by `PATCH /api/projects/[projectSlug]`. All fields optional.
 * `archivedAt: null` un-archives; a Date string archives.
 */
export interface UpdateProjectInput {
  name?: string
  description?: string | null
  color?: string | null
  icon?: string | null
  archivedAt?: string | null
}
