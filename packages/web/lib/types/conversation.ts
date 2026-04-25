/**
 * Shared types for the Chat-with-Agent feature. These mirror the Prisma
 * Conversation / ConversationMessage models but only expose fields that
 * are safe to ship to the client.
 */

export interface AgentProfileSummary {
  id: string
  slug: string
  name: string
  avatarUrl: string | null
  kind?: string
}

export interface Conversation {
  id: string
  title: string | null
  agentProfileId: string | null
  agentProfile: AgentProfileSummary | null
  lastMessageAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ConversationMessageRole = "user" | "assistant" | "system" | "tool"

export interface ConversationMessage {
  id: string
  conversationId: string
  role: ConversationMessageRole
  authorUserId: string | null
  authorAgentSlug: string | null
  content: string
  contentBlocks: unknown | null
  mentions: unknown | null
  toolCalls: unknown | null
  createdAt: string
}

export interface ConversationListResponse {
  conversations: Conversation[]
}

export interface ConversationDetailResponse {
  conversation: Conversation
  messages: ConversationMessage[]
}

export interface ConversationMessagesResponse {
  messages: ConversationMessage[]
  hasMore: boolean
}

export interface PostMessageResponse {
  userMessage: ConversationMessage
  agentMessage: ConversationMessage | null
}
