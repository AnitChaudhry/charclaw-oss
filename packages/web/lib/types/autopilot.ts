/**
 * Shared TypeScript types for the Autopilots feature.
 */

export type AutopilotTrigger = "cron" | "manual" | "webhook" | "on_pr_open"

export type AutopilotRunStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "skipped"

export interface AutopilotConfig {
  titleTemplate: string
  bodyTemplate: string
  priority?: number
  labels?: string[]
}

export interface Autopilot {
  id: string
  workspaceId: string
  name: string
  description: string | null
  enabled: boolean
  trigger: AutopilotTrigger
  schedule: string | null
  timezone: string
  agentProfileId: string | null
  repoId: string | null
  config: AutopilotConfig
  lastRunAt: string | null
  nextRunAt: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface AutopilotRun {
  id: string
  autopilotId: string
  status: AutopilotRunStatus
  issueId: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface CreateAutopilotInput {
  name: string
  description?: string
  trigger: AutopilotTrigger
  schedule?: string
  timezone?: string
  agentProfileId?: string | null
  repoId?: string | null
  config: AutopilotConfig
  workspaceId?: string
  workspaceSlug?: string
}

export interface UpdateAutopilotInput {
  name?: string
  description?: string | null
  enabled?: boolean
  trigger?: AutopilotTrigger
  schedule?: string | null
  timezone?: string
  agentProfileId?: string | null
  repoId?: string | null
  config?: AutopilotConfig
}
