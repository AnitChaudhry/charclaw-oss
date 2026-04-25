"use client"

import type { ReactNode } from "react"
import { TopBar } from "./TopBar"
import { WorkspaceRail } from "./WorkspaceRail"

interface WorkspaceChromeProps {
  workspaceSlug: string
  workspaceName: string
  children: ReactNode
}

/**
 * Client-side chrome wrapper for workspace-scoped routes. Layers the
 * WorkspaceRail on the left and a sticky TopBar on top of the page
 * content. Mounted from app/w/[workspaceSlug]/layout.tsx inside the
 * WorkspaceProvider so the TopBar + Rail can read the current workspace
 * via useWorkspace().
 */
export function WorkspaceChrome({
  workspaceSlug,
  workspaceName,
  children,
}: WorkspaceChromeProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <WorkspaceRail workspaceSlug={workspaceSlug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar workspaceSlug={workspaceSlug} workspaceName={workspaceName} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

export default WorkspaceChrome
