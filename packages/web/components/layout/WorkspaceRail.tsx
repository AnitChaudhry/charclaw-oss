"use client"

import { PinsSidebarNav } from "@/components/pins/PinsSidebarNav"
import { ProjectsSidebarNav } from "@/components/projects/ProjectsSidebarNav"
import ChatSidebarNav from "@/components/chat-with-agent/ChatSidebarNav"
import { AutopilotsSidebarNav } from "@/components/autopilots/AutopilotsSidebarNav"
import { cn } from "@/lib/shared/utils"

interface WorkspaceRailProps {
  workspaceSlug: string
  className?: string
}

/**
 * Left-hand rail for workspace-scoped routes (/w/:slug/**). Composes the
 * feature nav components each feature agent built so they actually render
 * in the product. The narrow 60px RepoSidebar lives to the left of this
 * rail; the chrome stack is: RepoSidebar (60px) | WorkspaceRail (224px) |
 * TopBar + main content.
 */
export function WorkspaceRail({ workspaceSlug, className }: WorkspaceRailProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex h-full w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-sidebar py-3",
        className
      )}
    >
      <PinsSidebarNav />
      <ProjectsSidebarNav workspaceSlug={workspaceSlug} />
      <ChatSidebarNav />
      <AutopilotsSidebarNav workspaceSlug={workspaceSlug} />
    </aside>
  )
}

export default WorkspaceRail
