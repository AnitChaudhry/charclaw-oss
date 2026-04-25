"use client"

import { useQuery } from "@tanstack/react-query"
import type { Agent } from "@charclaw/common"

interface RuntimeCapabilities {
  agents?: string[]
  agentVersions?: Record<string, string | null>
  freeDiskGb?: number
  platform?: string
}

interface RuntimeListItem {
  id: string
  name: string
  status: string
  capabilities: RuntimeCapabilities | null
  lastHeartbeat: string | null
}

const KNOWN_AGENTS: ReadonlyArray<Agent> = [
  "claude-code",
  "codex",
  "opencode",
  "gemini",
  "goose",
  "pi",
  "eliza",
]

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  if (entries.length === 0) return ""
  const qs = new URLSearchParams(entries as [string, string][]).toString()
  return `?${qs}`
}

async function fetchRuntimes(
  params: { workspaceSlug?: string; sandboxId?: string },
): Promise<RuntimeListItem[]> {
  const res = await fetch(`/api/runtimes${buildQuery(params)}`, {
    credentials: "include",
  })
  if (!res.ok) {
    throw new Error(`fetchRuntimes failed: ${res.status}`)
  }
  const data = (await res.json()) as { runtimes?: RuntimeListItem[] }
  return data.runtimes ?? []
}

export interface UseInstalledAgentsOptions {
  /** Scope to a workspace by slug (used when no sandboxId is given). */
  workspaceSlug?: string
  /**
   * When set, fetches just the runtime bound to this sandbox so the answer
   * reflects exactly the runtime that will run this branch's turn — instead
   * of the union across all the user's runtimes.
   */
  sandboxId?: string
}

/**
 * Returns the agent CLIs installed on the relevant runtime(s).
 *
 * - With `sandboxId`: returns the agents installed on the single runtime
 *   that owns this sandbox. The strictest, most accurate answer.
 * - Without `sandboxId`: returns the union across all the user's runtimes
 *   in the workspace. A looser answer suitable for non-branch contexts
 *   (e.g. settings, new-branch dialogs before a sandbox exists).
 *
 * `installedAgents` is `null` when:
 *   - the request errored out
 *   - no matching runtime was found
 *   - the matching runtime hasn't heartbeated capabilities yet
 *
 * Callers should treat `null` as "unknown" and fall back to showing every
 * agent enabled (consistent with the "Show all" behavior).
 */
export function useInstalledAgents(
  options: UseInstalledAgentsOptions = {},
): {
  installedAgents: ReadonlySet<Agent> | null
  isLoading: boolean
  isError: boolean
} {
  const { workspaceSlug, sandboxId } = options
  const query = useQuery({
    queryKey: ["installedAgents", sandboxId ?? "", workspaceSlug ?? ""],
    queryFn: () => fetchRuntimes({ workspaceSlug, sandboxId }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const runtimes = query.data ?? []
  const knownSet = new Set<Agent>(KNOWN_AGENTS)
  const merged = new Set<Agent>()
  let anyCapabilities = false

  for (const r of runtimes) {
    const agents = r.capabilities?.agents
    if (Array.isArray(agents)) {
      anyCapabilities = true
      for (const name of agents) {
        if (knownSet.has(name as Agent)) {
          merged.add(name as Agent)
        }
      }
    }
  }

  return {
    installedAgents:
      query.isError || runtimes.length === 0 || !anyCapabilities ? null : merged,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
