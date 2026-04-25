"use client"

/**
 * Right-pane message list + composer for a selected Conversation.
 */

import { useEffect, useRef } from "react"
import {
  useConversation,
  useConversationMessages,
  useConversationStream,
  useSendMessage,
} from "@/hooks/useConversations"
import { MessageBubble } from "@/components/chat-with-agent/MessageBubble"
import { Composer, type AgentStatus } from "@/components/chat-with-agent/Composer"
import { Loader2, MessageSquare } from "lucide-react"

interface ConversationViewProps {
  conversationId: string | null
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const { data: detail, isLoading: detailLoading } = useConversation(conversationId)
  const {
    data: messagesPage,
    isLoading: messagesLoading,
  } = useConversationMessages(conversationId)
  const send = useSendMessage()
  useConversationStream(conversationId)

  const endRef = useRef<HTMLDivElement>(null)

  const messages = messagesPage?.messages ?? detail?.messages ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center max-w-sm">
          <MessageSquare className="mx-auto h-8 w-8 opacity-50" />
          <div className="mt-3 text-sm">
            Select a chat on the left, or start a new one.
          </div>
        </div>
      </div>
    )
  }

  if (detailLoading || messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  const conv = detail?.conversation
  const agent = conv?.agentProfile ?? null
  const agentStatus: AgentStatus = "unknown"

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        {agent?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover border border-border/40"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            {(agent?.name ?? "A").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {conv?.title?.trim() || agent?.name || "Untitled chat"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {agent ? `@${agent.slug}` : "no agent"}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Say hi to kick things off.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              agent={agent}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <Composer
        agentName={agent?.name ?? undefined}
        agentStatus={agentStatus}
        disabled={send.isPending}
        onSend={async (text) => {
          await send.mutateAsync({ conversationId, content: text })
        }}
      />
    </div>
  )
}
