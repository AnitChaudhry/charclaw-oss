/**
 * Types for search and command palettes
 */

export interface RecentItem {
  id: string
  type: "repo" | "branch"
  repoOwner: string
  repoName: string
  branchName?: string
  timestamp: number
}

export interface SkillItem {
  id: string
  type: "skill"
  title: string
  description?: string
  tags: string[]
  useCount: number
}

export interface IssueItem {
  id: string
  type: "issue"
  title: string
  status: string
  assigneeAgent?: { name: string; kind: string }
}

/** Union of all palette-searchable item types */
export type PaletteItem = RecentItem | SkillItem | IssueItem
