"use client"

import Link from "next/link"
import { useState, type DragEvent, type MouseEvent } from "react"
import {
  Bookmark,
  Filter,
  Folder,
  MessageSquare,
  GitBranch,
  Link as LinkIcon,
  GripVertical,
  MoreHorizontal,
  Trash2,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/shared/utils"
import type { Pin, PinKind } from "@/lib/types/pin"

/**
 * Icon to display for each pin kind when no custom `icon` is set. Kept as
 * a regular map (rather than a component registry) so tree-shaking works.
 */
function KindIcon({ kind, className }: { kind: PinKind; className?: string }) {
  const iconProps = { className: className ?? "size-3.5", "aria-hidden": true }
  switch (kind) {
    case "issue_filter":
      return <Filter {...iconProps} />
    case "project":
      return <Folder {...iconProps} />
    case "conversation":
      return <MessageSquare {...iconProps} />
    case "repo":
      return <GitBranch {...iconProps} />
    case "url":
      return <LinkIcon {...iconProps} />
    default:
      return <Bookmark {...iconProps} />
  }
}

function kindLabel(kind: PinKind): string {
  switch (kind) {
    case "issue_filter":
      return "Filter"
    case "project":
      return "Project"
    case "conversation":
      return "Chat"
    case "repo":
      return "Repo"
    case "url":
      return "Link"
    default:
      return kind
  }
}

export interface PinItemProps {
  pin: Pin
  isDragging?: boolean
  isDragOver?: boolean
  onDelete?: (pinId: string) => void
  onDragStart?: (e: DragEvent<HTMLDivElement>, pinId: string) => void
  onDragOver?: (e: DragEvent<HTMLDivElement>, pinId: string) => void
  onDragLeave?: (e: DragEvent<HTMLDivElement>, pinId: string) => void
  onDrop?: (e: DragEvent<HTMLDivElement>, pinId: string) => void
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void
}

export function PinItem({
  pin,
  isDragging,
  isDragOver,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: PinItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isExternal = pin.kind === "url"

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    // Right-click opens the item's menu, matching sidebar affordances
    // elsewhere in the app.
    e.preventDefault()
    setMenuOpen(true)
  }

  return (
    <div
      className={cn(
        "group relative flex items-center gap-1 rounded-md px-1.5 py-1 text-sm",
        "hover:bg-muted/60",
        isDragging && "opacity-40",
        isDragOver && "outline-primary outline outline-1"
      )}
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, pin.id)}
      onDragOver={(e) => onDragOver?.(e, pin.id)}
      onDragLeave={(e) => onDragLeave?.(e, pin.id)}
      onDrop={(e) => onDrop?.(e, pin.id)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onContextMenu={handleContextMenu}
      data-pin-id={pin.id}
      data-kind={pin.kind}
    >
      {onDragStart && (
        <span
          className="text-muted-foreground/60 flex cursor-grab items-center opacity-0 group-hover:opacity-100"
          aria-hidden
        >
          <GripVertical className="size-3.5" />
        </span>
      )}
      <Link
        href={pin.href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2"
        title={`${kindLabel(pin.kind as PinKind)}: ${pin.label}`}
      >
        <span className="text-muted-foreground shrink-0">
          <KindIcon kind={pin.kind as PinKind} />
        </span>
        <span className="truncate">{pin.label}</span>
        {isExternal && (
          <ExternalLink
            className="text-muted-foreground/60 size-3 shrink-0"
            aria-hidden
          />
        )}
      </Link>
      {onDelete && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Pin ${pin.label} menu`}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => onDelete(pin.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Remove pin
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export { KindIcon, kindLabel }
