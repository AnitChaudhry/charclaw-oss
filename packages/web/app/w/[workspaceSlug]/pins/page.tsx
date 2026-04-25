"use client"

import { useState, type DragEvent } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { usePins } from "@/hooks/usePins"
import { AddPinDialog } from "@/components/pins/AddPinDialog"
import { KindIcon, kindLabel } from "@/components/pins/PinItem"
import { computeReorder } from "@/components/pins/PinsSidebarNav"
import { cn } from "@/lib/shared/utils"
import type { Pin, PinKind } from "@/lib/types/pin"

/**
 * /w/[slug]/pins — compact management page. Shows all of the caller's
 * pins in a table with inline rename, drag-reorder, and delete. For
 * now it uses the same HTML5-DnD flow as the sidebar — a fancier
 * editor can come later.
 */
export default function PinsManagementPage() {
  const {
    pins,
    isLoading,
    createPin,
    updatePin,
    deletePin,
    reorderPins,
  } = usePins()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const ordered = [...pins].sort((a, b) => a.position - b.position)

  const onDragStart = (e: DragEvent<HTMLTableRowElement>, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = "move"
    try {
      e.dataTransfer.setData("text/plain", id)
    } catch {
      /* noop */
    }
  }

  const onDragOver = (e: DragEvent<HTMLTableRowElement>, id: string) => {
    if (!draggingId || draggingId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (overId !== id) setOverId(id)
  }

  const onDrop = async (e: DragEvent<HTMLTableRowElement>, targetId: string) => {
    e.preventDefault()
    const source = draggingId
    setDraggingId(null)
    setOverId(null)
    if (!source || source === targetId) return
    const next = computeReorder(ordered, source, targetId)
    if (!next) return
    try {
      await reorderPins(next)
    } catch {
      /* rollback handled in usePins */
    }
  }

  const onDragEnd = () => {
    setDraggingId(null)
    setOverId(null)
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pins</h1>
          <p className="text-muted-foreground text-sm">
            Saved filters and shortcuts pinned to your sidebar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm"
        >
          <Plus className="size-3.5" />
          Add pin
        </button>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {!isLoading && ordered.length === 0 && (
        <p className="text-muted-foreground text-sm italic">
          You don&apos;t have any pins yet.
        </p>
      )}

      {!isLoading && ordered.length > 0 && (
        <div className="border-input overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="w-20 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((pin, idx) => (
                <PinRow
                  key={pin.id}
                  pin={pin}
                  index={idx}
                  isDragging={draggingId === pin.id}
                  isDragOver={overId === pin.id}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  onRename={(label) => updatePin({ pinId: pin.id, patch: { label } })}
                  onDelete={() => deletePin(pin.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddPinDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={createPin}
      />
    </div>
  )
}

interface PinRowProps {
  pin: Pin
  index: number
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: DragEvent<HTMLTableRowElement>, id: string) => void
  onDragOver: (e: DragEvent<HTMLTableRowElement>, id: string) => void
  onDrop: (e: DragEvent<HTMLTableRowElement>, id: string) => void
  onDragEnd: () => void
  onRename: (label: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}

function PinRow({
  pin,
  index,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRename,
  onDelete,
}: PinRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(pin.label)

  const commit = async () => {
    if (draft.trim() && draft !== pin.label) {
      try {
        await onRename(draft.trim())
      } catch {
        setDraft(pin.label)
      }
    } else {
      setDraft(pin.label)
    }
    setEditing(false)
  }

  return (
    <tr
      draggable
      onDragStart={(e) => onDragStart(e, pin.id)}
      onDragOver={(e) => onDragOver(e, pin.id)}
      onDrop={(e) => onDrop(e, pin.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "border-input border-t",
        isDragging && "opacity-40",
        isDragOver && "bg-primary/5"
      )}
    >
      <td className="text-muted-foreground px-3 py-2 text-xs">{index + 1}</td>
      <td className="px-3 py-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                setDraft(pin.label)
                setEditing(false)
              }
            }}
            className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="hover:underline"
          >
            {pin.label}
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <KindIcon kind={pin.kind as PinKind} />
          {kindLabel(pin.kind as PinKind)}
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-2 text-xs">
        <Link
          href={pin.href}
          target={pin.kind === "url" ? "_blank" : undefined}
          rel={pin.kind === "url" ? "noopener noreferrer" : undefined}
          className="truncate hover:underline"
        >
          {pin.href}
        </Link>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete pin ${pin.label}`}
          className="text-muted-foreground hover:bg-muted hover:text-destructive inline-flex size-7 items-center justify-center rounded-md"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  )
}
