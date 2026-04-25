/**
 * Query key factory for TanStack Query
 *
 * Provides a centralized, type-safe way to manage query keys.
 */
export const queryKeys = {
  user: {
    all: ["user"] as const,
    me: () => [...queryKeys.user.all, "me"] as const,
  },
  sync: {
    all: ["sync"] as const,
    data: () => [...queryKeys.sync.all, "data"] as const,
  },
  issues: {
    all: ["issues"] as const,
    list: (status?: string) => [...queryKeys.issues.all, "list", status ?? "all"] as const,
    detail: (issueId: string) => [...queryKeys.issues.all, "detail", issueId] as const,
  },
  agentProfiles: {
    all: ["agentProfiles"] as const,
    list: () => [...queryKeys.agentProfiles.all, "list"] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
