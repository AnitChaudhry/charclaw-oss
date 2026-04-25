"use client"

/**
 * /w/[workspaceSlug]/chat — conversation list view.
 *
 * Left rail lists the caller's chats; right pane shows an empty state
 * until a chat is selected. Clicking a chat navigates to the detail
 * route so URLs are shareable.
 */

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useConversations } from "@/hooks/useConversations"
import { ConversationList } from "@/components/chat-with-agent/ConversationList"
import { ConversationView } from "@/components/chat-with-agent/ConversationView"
import { NewConversationDialog } from "@/components/chat-with-agent/NewConversationDialog"

export default function ChatIndexPage() {
  const router = useRouter()
  const params = useParams<{ workspaceSlug: string }>()
  const workspaceSlug = params?.workspaceSlug
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: conversations = [], isLoading } = useConversations()

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversations={conversations}
          selectedId={null}
          isLoading={isLoading}
          onSelect={(c) =>
            router.push(`/w/${workspaceSlug}/chat/${c.id}`)
          }
          onNewChat={() => setDialogOpen(true)}
        />
        <ConversationView conversationId={null} />
      </div>
      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => router.push(`/w/${workspaceSlug}/chat/${id}`)}
      />
    </div>
  )
}
