"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { ChevronRight, LogOut, User as UserIcon } from "lucide-react"
import { InboxBell } from "@/components/inbox/InboxBell"
import { useWorkspace } from "@/components/workspace/WorkspaceProvider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/shared/utils"

interface TopBarProps {
  workspaceSlug: string
  workspaceName?: string
  className?: string
}

/**
 * Map the current pathname (under /w/:slug/...) to a human-readable
 * section label. Returns null when we're on the workspace root.
 */
function sectionFromPath(pathname: string | null, slug: string): string | null {
  if (!pathname) return null
  const prefix = `/w/${slug}`
  if (pathname === prefix || pathname === `${prefix}/`) return null
  const rest = pathname.slice(prefix.length + 1).split("/")[0]
  if (!rest) return null
  switch (rest) {
    case "inbox":
      return "Inbox"
    case "projects":
      return "Projects"
    case "chat":
      return "Chat"
    case "autopilots":
      return "Autopilots"
    case "pins":
      return "Pins"
    default:
      return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
}

/**
 * TopBar — sticky header rendered inside the workspace-scoped layout.
 * Shows a workspace + section breadcrumb on the left and the inbox
 * bell plus a user avatar dropdown on the right. The bar never
 * appears on the root-level `/` or standalone pages — it's only
 * mounted from `app/w/[workspaceSlug]/layout.tsx`.
 */
export function TopBar({ workspaceSlug, workspaceName, className }: TopBarProps) {
  const ws = useWorkspace()
  const resolvedName = workspaceName ?? ws?.name ?? workspaceSlug
  const pathname = usePathname()
  const section = sectionFromPath(pathname, workspaceSlug)

  const { data: session } = useSession()
  const user = session?.user
  const displayName = user?.name ?? user?.email ?? "Account"
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?"

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur",
        className
      )}
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href={`/w/${workspaceSlug}`}
          className="truncate font-medium text-foreground hover:text-primary"
        >
          {resolvedName}
        </Link>
        {section && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{section}</span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-1">
        <InboxBell workspaceSlug={workspaceSlug} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{displayName}</span>
              {user?.email && user.email !== displayName && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/w/${workspaceSlug}`} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                Workspace home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                signOut({ callbackUrl: "/login" })
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default TopBar
