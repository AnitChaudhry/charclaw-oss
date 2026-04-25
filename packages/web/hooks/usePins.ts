"use client"

import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  Pin,
  CreatePinInput,
  UpdatePinInput,
  ReorderPinsInput,
} from "@/lib/types/pin"

const PINS_QUERY_KEY = ["pins", "list"] as const

async function fetchPins(): Promise<Pin[]> {
  const res = await fetch("/api/pins")
  if (!res.ok) throw new Error("Failed to fetch pins")
  const data = await res.json()
  return data.pins as Pin[]
}

async function createPinRequest(input: CreatePinInput): Promise<Pin> {
  const res = await fetch("/api/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to create pin")
  }
  const data = await res.json()
  return data.pin as Pin
}

async function updatePinRequest({
  pinId,
  patch,
}: {
  pinId: string
  patch: UpdatePinInput
}): Promise<Pin> {
  const res = await fetch(`/api/pins/${pinId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to update pin")
  }
  const data = await res.json()
  return data.pin as Pin
}

async function deletePinRequest(pinId: string): Promise<void> {
  const res = await fetch(`/api/pins/${pinId}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to delete pin")
  }
}

async function reorderPinsRequest(order: ReorderPinsInput["order"]): Promise<void> {
  const res = await fetch("/api/pins/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to reorder pins")
  }
}

export interface UsePins {
  pins: Pin[]
  isLoading: boolean
  error: Error | null
  createPin: (input: CreatePinInput) => Promise<Pin>
  updatePin: (args: { pinId: string; patch: UpdatePinInput }) => Promise<Pin>
  deletePin: (pinId: string) => Promise<void>
  reorderPins: (order: ReorderPinsInput["order"]) => Promise<void>
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  isReordering: boolean
}

export function usePins(): UsePins {
  const qc = useQueryClient()

  const { data: pins = [], isLoading, error } = useQuery({
    queryKey: PINS_QUERY_KEY,
    queryFn: fetchPins,
  })

  const createMutation = useMutation({
    mutationFn: createPinRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PINS_QUERY_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updatePinRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PINS_QUERY_KEY })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePinRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PINS_QUERY_KEY })
    },
  })

  /**
   * Optimistic reorder — we immediately rewrite the cache so the list
   * doesn't jump back to its old order while the request is in flight.
   * On error we roll back to the previous snapshot.
   */
  const reorderMutation = useMutation({
    mutationFn: reorderPinsRequest,
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: PINS_QUERY_KEY })
      const prev = qc.getQueryData<Pin[]>(PINS_QUERY_KEY)
      if (prev) {
        const posById = new Map(order.map((o) => [o.id, o.position]))
        const next = prev
          .map((p) =>
            posById.has(p.id) ? { ...p, position: posById.get(p.id) as number } : p
          )
          .sort((a, b) => a.position - b.position)
        qc.setQueryData(PINS_QUERY_KEY, next)
      }
      return { prev }
    },
    onError: (_err, _order, ctx) => {
      if (ctx?.prev) qc.setQueryData(PINS_QUERY_KEY, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PINS_QUERY_KEY })
    },
  })

  const reorderPins = useCallback(
    (order: ReorderPinsInput["order"]) => reorderMutation.mutateAsync(order),
    [reorderMutation]
  )

  return {
    pins,
    isLoading,
    error: (error as Error | null) ?? null,
    createPin: createMutation.mutateAsync,
    updatePin: updateMutation.mutateAsync,
    deletePin: deleteMutation.mutateAsync,
    reorderPins,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  }
}
