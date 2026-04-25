"use client"

/**
 * Single message renderer for the Chat-with-Agent surface.
 *
 * Handles user / assistant / system / tool roles. Renders the agent
 * avatar or initials. Falls back to plain text when mention rendering
 * isn't available.
 */

import { useMemo } from "react"
import { cn } from "@/lib/shared/utils"
import type { ConversationMessage } from "@/lib/types/conversation"

interface MessageBubbleProps {
  message: ConversationMessage
  agent?: {
    name: string
    slug: string
    avatarUrl: string | null
  } | null
  currentUserLabel?: string
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function Avatar({
  label,
  url,
  tone,
}: {
  label: string
  url?: string | null
  tone: "user" | "agent" | "system" | "tool"
}) {
  const toneClass =
    tone === "user"
      ? "bg-primary/10 text-primary"
      : tone === "agent"
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : tone === "tool"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-muted text-muted-foreground"
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-8 w-8 rounded-full object-cover border border-border/40"
      />
    )
  }
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
        toneClass
      )}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function MessageBubble({
  message,
  agent,
  currentUserLabel = "You",
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const isTool = message.role === "tool"

  const label = useMemo(() => {
    if (isUser) return currentUserLabel
    if (isAssistant) return agent?.name ?? message.authorAgentSlug ?? "Agent"
    if (isTool) return "Tool"
    return "System"
  }, [isUser, isAssistant, isTool, agent, message.authorAgentSlug, currentUserLabel])

  const tone: "user" | "agent" | "system" | "tool" = isUser
    ? "user"
    : isAssistant
      ? "agent"
      : isTool
        ? "tool"
        : "system"

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      data-role={message.role}
    >
      <Avatar
        label={label}
        url={isAssistant ? agent?.avatarUrl : null}
        tone={tone}
      />
      <div
        className={cn(
          "flex min-w-0 max-w-[720px] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="font-medium text-foreground/80">{label}</span>
          <span>{relativeTime(message.createdAt)}</span>
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words border",
            isUser
              ? "bg-primary/5 border-primary/10 text-foreground"
              : isAssistant
                ? "bg-card border-border text-foreground"
                : "bg-muted border-border/50 text-muted-foreground"
          )}
        >
          {message.content || (
            (message.contentBlocks as { status?: string } | null)?.status === "streaming"
              ? <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:400ms]" />
                </span>
              : null
          )}
          {(() => {
            const status = (message.contentBlocks as { status?: string; error?: string } | null)?.status
            if (status === "offline_stub") {
              return (
                <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground align-middle">
                  agent offline
                </span>
              )
            }
            if (status === "failed") {
              const err = (message.contentBlocks as { error?: string } | null)?.error
              return (
                <span className="mt-1 block rounded-sm bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  error{err ? `: ${err}` : ""}
                </span>
              )
            }
            return null
          })()}
        </div>
      </div>
    </div>
  )
}
