"use client"

/**
 * /w/[workspaceSlug]/chat/[conversationId] — full-screen detail view.
 *
 * Same two-pane layout as the list page, just with a conversation
 * preselected from the URL.
 */

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useConversations } from "@/hooks/useConversations"
import { ConversationList } from "@/components/chat-with-agent/ConversationList"
import { ConversationView } from "@/components/chat-with-agent/ConversationView"
import { NewConversationDialog } from "@/components/chat-with-agent/NewConversationDialog"

export default function ChatDetailPage() {
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string; conversationId: string }>()
  const workspaceSlug = params?.workspaceSlug
  const conversationId = params?.conversationId ?? null
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: conversations = [], isLoading } = useConversations()

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversations={conversations}
          selectedId={conversationId}
          isLoading={isLoading}
          onSelect={(c) =>
            router.push(`/w/${workspaceSlug}/chat/${c.id}`)
          }
          onNewChat={() => setDialogOpen(true)}
        />
        <ConversationView conversationId={conversationId} />
      </div>
      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => router.push(`/w/${workspaceSlug}/chat/${id}`)}
      />
    </div>
  )
}
