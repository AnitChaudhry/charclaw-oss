"use client"

/**
 * TanStack Query hooks for the Chat-with-Agent feature.
 *
 * - useConversations(): list the caller's conversations in active workspace
 * - useConversation(id): detail + first page of messages
 * - useConversationMessages(id): paginated messages
 * - useSendMessage(id): mutation to post a user message
 * - useCreateConversation(): mutation to create a new 1:1 chat
 * - useUpdateConversation(id): PATCH title / archivedAt
 * - useDeleteConversation(): DELETE
 * - useConversationStream(id): subscribe via SSE, invalidate queries on events
 */

import { useEffect } from "react"
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import type {
  Conversation,
  ConversationDetailResponse,
  ConversationListResponse,
  ConversationMessage,
  ConversationMessagesResponse,
  PostMessageResponse,
} from "@/lib/types/conversation"

// =============================================================================
// Query keys
// =============================================================================

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (): QueryKey => [...conversationKeys.all, "list"] as const,
  detail: (id: string): QueryKey => [...conversationKeys.all, "detail", id] as const,
  messages: (id: string): QueryKey =>
    [...conversationKeys.all, "messages", id] as const,
}

// =============================================================================
// Fetchers
// =============================================================================

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations")
  if (!res.ok) throw new Error("Failed to load conversations")
  const data = (await res.json()) as ConversationListResponse
  return data.conversations
}

async function fetchConversation(
  conversationId: string
): Promise<ConversationDetailResponse> {
  const res = await fetch(`/api/conversations/${conversationId}`)
  if (!res.ok) throw new Error("Failed to load conversation")
  return (await res.json()) as ConversationDetailResponse
}

async function fetchMessages(
  conversationId: string,
  before?: string,
  limit = 50
): Promise<ConversationMessagesResponse> {
  const qs = new URLSearchParams()
  if (before) qs.set("before", before)
  qs.set("limit", String(limit))
  const res = await fetch(
    `/api/conversations/${conversationId}/messages?${qs.toString()}`
  )
  if (!res.ok) throw new Error("Failed to load messages")
  return (await res.json()) as ConversationMessagesResponse
}

interface CreateConversationInput {
  agentProfileId: string
  title?: string
}

async function createConversation(
  input: CreateConversationInput
): Promise<Conversation> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to create conversation")
  }
  const data = await res.json()
  return data.conversation as Conversation
}

interface SendMessageInput {
  conversationId: string
  content: string
}

async function sendMessage(
  input: SendMessageInput
): Promise<PostMessageResponse> {
  const res = await fetch(
    `/api/conversations/${input.conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.content }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to send message")
  }
  return (await res.json()) as PostMessageResponse
}

interface UpdateConversationInput {
  conversationId: string
  title?: string | null
  archivedAt?: string | null
}

async function updateConversation(
  input: UpdateConversationInput
): Promise<Conversation> {
  const { conversationId, ...patch } = input
  const res = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error("Failed to update conversation")
  const data = await res.json()
  return data.conversation as Conversation
}

async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete conversation")
}

// =============================================================================
// Hooks
// =============================================================================

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: fetchConversations,
  })
}

export function useConversation(conversationId: string | null | undefined) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: conversationId
      ? conversationKeys.detail(conversationId)
      : conversationKeys.all,
    queryFn: () => fetchConversation(conversationId!),
  })
}

export function useConversationMessages(
  conversationId: string | null | undefined
) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: conversationId
      ? conversationKeys.messages(conversationId)
      : conversationKeys.all,
    queryFn: () => fetchMessages(conversationId!),
  })
}

export function useCreateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: conversationKeys.list() })
      qc.invalidateQueries({
        queryKey: conversationKeys.messages(variables.conversationId),
      })
      qc.invalidateQueries({
        queryKey: conversationKeys.detail(variables.conversationId),
      })
    },
  })
}

export function useUpdateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateConversation,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: conversationKeys.list() })
      qc.invalidateQueries({
        queryKey: conversationKeys.detail(variables.conversationId),
      })
    },
  })
}

export function useDeleteConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

/**
 * Subscribe to SSE events for a conversation. On every event we bump
 * the messages/list caches. We keep the subscription passive (no
 * rendered state) — components can rely on TanStack Query for data.
 */
export function useConversationStream(conversationId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!conversationId) return
    if (typeof window === "undefined") return
    if (typeof EventSource === "undefined") return

    const es = new EventSource(
      `/api/conversations/${conversationId}/stream`
    )

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type: string
          conversationId: string
          payload: ConversationMessage
        }
        if (data.type === "message.created") {
          qc.setQueryData<ConversationMessagesResponse | undefined>(
            conversationKeys.messages(conversationId),
            (prev) => {
              if (!prev) return prev
              if (prev.messages.some((m) => m.id === data.payload.id)) return prev
              return {
                ...prev,
                messages: [...prev.messages, data.payload],
              }
            }
          )
        }
        qc.invalidateQueries({ queryKey: conversationKeys.list() })
      } catch {
        // ignore malformed event
      }
    }

    es.onerror = () => {
      // Browsers auto-reconnect; we just rely on that. If the server
      // really is down, TanStack's own polling still picks up changes.
    }

    return () => {
      es.close()
    }
  }, [conversationId, qc])
}
