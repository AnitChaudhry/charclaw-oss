"use client"

import Link from "next/link"
import { Fragment } from "react"
import { cn } from "@/lib/shared/utils"
import type { ResolvedMentionDTO } from "@/lib/types/inbox"

interface MentionTextProps {
  body: string
  mentions?: ResolvedMentionDTO[] | null
  className?: string
}

/**
 * Renders a comment/message body with `@handle` spans styled as chips that
 * link to the relevant user or agent page. If `mentions` is null/empty the
 * body is rendered as plain text.
 *
 * Regex matches the same shape the backend parser uses so we can safely
 * swap in chip spans at the identified positions.
 */
export function MentionText({ body, mentions, className }: MentionTextProps) {
  if (!body) return null
  if (!mentions || mentions.length === 0) {
    return <span className={cn("whitespace-pre-wrap", className)}>{body}</span>
  }

  // Build a lookup of handle -> mention. We key case-insensitive since the
  // backend resolver is case-insensitive too.
  const lookup = new Map<string, ResolvedMentionDTO>()
  for (const m of mentions) {
    lookup.set(m.handle.toLowerCase(), m)
  }

  const regex = /(^|\s)@([a-zA-Z0-9_-]{1,40})\b/g
  const nodes: Array<string | { kind: "mention"; mention: ResolvedMentionDTO; raw: string }> = []
  let cursor = 0

  for (const match of body.matchAll(regex)) {
    const leading = match[1] ?? ""
    const handle = match[2]
    const start = (match.index ?? 0) + leading.length
    if (start > cursor) {
      nodes.push(body.slice(cursor, start))
    }
    const found = lookup.get(handle.toLowerCase())
    if (found) {
      nodes.push({ kind: "mention", mention: found, raw: `@${handle}` })
    } else {
      nodes.push(`@${handle}`)
    }
    cursor = start + 1 + handle.length
  }
  if (cursor < body.length) nodes.push(body.slice(cursor))

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {nodes.map((node, i) => {
        if (typeof node === "string") return <Fragment key={i}>{node}</Fragment>
        const m = node.mention
        const href =
          m.kind === "user"
            ? `/u/${encodeURIComponent(m.handle)}`
            : `/agents/${encodeURIComponent(m.handle)}`
        return (
          <Link
            key={i}
            href={href}
            className="rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
            title={m.displayName}
          >
            @{m.handle}
          </Link>
        )
      })}
    </span>
  )
}

export default MentionText
