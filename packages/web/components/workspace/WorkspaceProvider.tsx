"use client"

import { createContext, useContext, type ReactNode } from "react"

export interface WorkspaceInfo {
  id: string
  slug: string
  name: string
  role: string
}

const WorkspaceContext = createContext<WorkspaceInfo | null>(null)

interface WorkspaceProviderProps {
  workspace: WorkspaceInfo
  children: ReactNode
}

export function WorkspaceProvider({ workspace, children }: WorkspaceProviderProps) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * useWorkspace — access the active workspace from anywhere inside a
 * WorkspaceProvider. Returns null when no workspace is mounted (e.g. on
 * the legacy / route that doesn't yet require a workspace).
 */
export function useWorkspace(): WorkspaceInfo | null {
  return useContext(WorkspaceContext)
}

/**
 * useRequiredWorkspace — like useWorkspace but throws if no workspace is
 * in context. Use inside pages that live under /w/[workspaceSlug].
 */
export function useRequiredWorkspace(): WorkspaceInfo {
  const ws = useContext(WorkspaceContext)
  if (!ws) {
    throw new Error(
      "useRequiredWorkspace must be used inside a WorkspaceProvider (typically under /w/[workspaceSlug])"
    )
  }
  return ws
}
