"use client"

import { useMemo, useState, type DragEvent } from "react"
import { Plus, Pin as PinIcon } from "lucide-react"
import { usePins } from "@/hooks/usePins"
import { cn } from "@/lib/shared/utils"
import { PinItem } from "./PinItem"
import { AddPinDialog } from "./AddPinDialog"
import type { Pin } from "@/lib/types/pin"

export interface PinsSidebarNavProps {
  className?: string
  /**
   * Optional project list passed through to the AddPinDialog.
   * If omitted, the dialog falls back to a manual targetRef input.
   */
  projects?: { id: string; name: string; slug: string }[]
  /**
   * Hide the section header (shown when this nav is embedded in a
   * larger sidebar that already has its own "Pins" header).
   */
  hideHeader?: boolean
}

interface DragState {
  draggingId: string | null
  overId: string | null
}

/**
 * PinsSidebarNav — an ordered list of pins for the active workspace
 * with HTML5-DnD reorder and a trailing "+" button. Rendering is
 * scoped entirely to this component; embedders simply mount it and
 * it pulls data from `usePins`.
 */
export function PinsSidebarNav({
  className,
  projects,
  hideHeader,
}: PinsSidebarNavProps) {
  const {
    pins,
    isLoading,
    createPin,
    deletePin,
    reorderPins,
  } = usePins()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drag, setDrag] = useState<DragState>({
    draggingId: null,
    overId: null,
  })

  const ordered = useMemo(
    () => [...pins].sort((a, b) => a.position - b.position),
    [pins]
  )

  const onDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDrag({ draggingId: id, overId: null })
    e.dataTransfer.effectAllowed = "move"
    // Firefox requires dataTransfer.setData to start a drag.
    try {
      e.dataTransfer.setData("text/plain", id)
    } catch {
      /* noop */
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!drag.draggingId || drag.draggingId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (drag.overId !== id) setDrag((s) => ({ ...s, overId: id }))
  }

  const onDragLeave = (_e: DragEvent<HTMLDivElement>, id: string) => {
    if (drag.overId === id) setDrag((s) => ({ ...s, overId: null }))
  }

  const onDrop = async (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    const sourceId = drag.draggingId
    setDrag({ draggingId: null, overId: null })
    if (!sourceId || sourceId === targetId) return

    const next = computeReorder(ordered, sourceId, targetId)
    if (!next) return
    try {
      await reorderPins(next)
    } catch {
      // Optimistic layer in usePins rolls back; we just surface no error UI here.
    }
  }

  const onDragEnd = () => setDrag({ draggingId: null, overId: null })

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Pins">
      {!hideHeader && (
        <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs font-medium uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <PinIcon className="size-3" />
            Pins
          </span>
        </div>
      )}
      <div className="flex flex-col">
        {isLoading && (
          <div className="text-muted-foreground px-2 py-1 text-xs">
            Loading…
          </div>
        )}
        {!isLoading && ordered.length === 0 && (
          <div className="text-muted-foreground px-2 py-1 text-xs italic">
            No pins yet.
          </div>
        )}
        {ordered.map((pin) => (
          <PinItem
            key={pin.id}
            pin={pin}
            isDragging={drag.draggingId === pin.id}
            isDragOver={drag.overId === pin.id}
            onDelete={deletePin}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="text-muted-foreground hover:bg-muted hover:text-foreground mt-1 flex items-center gap-2 rounded-md px-2 py-1 text-xs"
        aria-label="Add pin"
      >
        <Plus className="size-3.5" />
        Add pin
      </button>
      <AddPinDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={createPin}
        projects={projects}
      />
    </nav>
  )
}

/**
 * Given an ordered list and a drag operation, return a new [{id,position}]
 * array that moves `sourceId` to the slot currently held by `targetId`.
 * Exposed for testability.
 */
export function computeReorder(
  ordered: Pin[],
  sourceId: string,
  targetId: string
): { id: string; position: number }[] | null {
  const from = ordered.findIndex((p) => p.id === sourceId)
  const to = ordered.findIndex((p) => p.id === targetId)
  if (from < 0 || to < 0 || from === to) return null
  const next = ordered.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next.map((p, i) => ({ id: p.id, position: i }))
}
