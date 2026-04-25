"use client"

/**
 * Textarea + Send composer for the Chat-with-Agent surface.
 *
 * Cmd/Ctrl+Enter submits. Plain Enter inserts a newline. Shows an
 * agent-status pill (online / offline / unknown).
 */

import { useCallback, useRef, useState, type KeyboardEvent } from "react"
import { SendHorizonal } from "lucide-react"
import { cn } from "@/lib/shared/utils"

export type AgentStatus = "online" | "offline" | "busy" | "unknown"

interface ComposerProps {
  onSend: (text: string) => Promise<void> | void
  disabled?: boolean
  agentName?: string
  agentStatus?: AgentStatus
  placeholder?: string
}

const statusLabel: Record<AgentStatus, string> = {
  online: "online",
  offline: "offline",
  busy: "busy",
  unknown: "unknown",
}

const statusDot: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground/40",
  busy: "bg-amber-500",
  unknown: "bg-muted-foreground/40",
}

export function Composer({
  onSend,
  disabled,
  agentName,
  agentStatus = "unknown",
  placeholder = "Message the agent...",
}: ComposerProps) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(async () => {
    const text = value.trim()
    if (!text || sending || disabled) return
    setSending(true)
    try {
      await onSend(text)
      setValue("")
      ref.current?.focus()
    } finally {
      setSending(false)
    }
  }, [value, sending, disabled, onSend])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        void submit()
      }
    },
    [submit]
  )

  const isBusy = sending || disabled

  return (
    <div className="border-t border-border bg-background">
      <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span
            className={cn("inline-block h-1.5 w-1.5 rounded-full", statusDot[agentStatus])}
          />
          <span>
            {agentName ? <span className="font-medium text-foreground/80">{agentName}</span> : "Agent"}{" "}
            <span>· {statusLabel[agentStatus]}</span>
          </span>
        </div>
        <span className="hidden md:inline text-[11px] text-muted-foreground/80">
          Cmd/Ctrl + Enter to send
        </span>
      </div>
      <div className="px-4 pb-4 flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={isBusy}
          placeholder={placeholder}
          className={cn(
            "flex-1 min-h-[48px] max-h-[240px] resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isBusy || !value.trim()}
          className={cn(
            "h-10 px-3 rounded-md inline-flex items-center gap-2 text-sm font-medium shadow-xs border",
            "bg-primary text-primary-foreground border-primary/10",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <SendHorizonal className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  )
}
