"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap } from "lucide-react"

interface AutopilotsSidebarNavProps {
  workspaceSlug: string
}

/**
 * Small nav entry for the Autopilots feature. The existing repo-sidebar
 * is intentionally not modified; callers opt in by rendering this
 * component alongside their sidebar chrome.
 */
export function AutopilotsSidebarNav({ workspaceSlug }: AutopilotsSidebarNavProps) {
  const pathname = usePathname()
  const href = `/w/${workspaceSlug}/autopilots`
  const active = pathname?.startsWith(href)
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm " +
        (active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      <Zap className="h-4 w-4" />
      <span>Autopilots</span>
    </Link>
  )
}
