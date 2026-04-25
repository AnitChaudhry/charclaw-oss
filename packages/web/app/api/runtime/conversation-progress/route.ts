/**
 * POST /api/runtime/conversation-progress
 *
 * Daemon-side ingress for chat-turn progress. The daemon POSTs events as
 * the agent CLI streams output; this route appends them to the assistant
 * placeholder `ConversationMessage` row identified by `turnId`.
 *
 * Body:
 *   { turnId: string,
 *     conversationId: string,
 *     kind: "delta" | "completed" | "failed",
 *     textDelta?: string,
 *     finalContent?: string,
 *     error?: string }
 *
 * Auth: daemon Bearer token (requireDaemonAuth).
 */

import { prisma } from "@/lib/db/prisma"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"
import { publishConversationEvent } from "@/lib/chat/conversation-events"

interface Payload {
  turnId?: string
  conversationId?: string
  kind?: "delta" | "completed" | "failed"
  textDelta?: string
  finalContent?: string
  error?: string
}

export async function POST(req: Request) {
  const auth = await requireDaemonAuth(req)
  if (auth instanceof Response) return auth

  const body = (await req.json().catch(() => ({}))) as Payload
  const { turnId, conversationId, kind } = body
  if (!turnId || !conversationId || !kind) {
    return Response.json({ error: "turnId, conversationId, kind required" }, { status: 400 })
  }

  const placeholder = await prisma.conversationMessage.findUnique({
    where: { id: turnId },
    select: {
      id: true,
      conversationId: true,
      content: true,
      contentBlocks: true,
      role: true,
    },
  })
  if (!placeholder || placeholder.conversationId !== conversationId) {
    return Response.json({ error: "turn not found" }, { status: 404 })
  }

  const currentBlocks = (placeholder.contentBlocks as Record<string, unknown> | null) ?? {}

  if (kind === "delta") {
    const delta = body.textDelta ?? ""
    if (!delta) return Response.json({ ok: true })
    const updated = await prisma.conversationMessage.update({
      where: { id: turnId },
      data: {
        content: (placeholder.content ?? "") + delta,
        contentBlocks: { ...currentBlocks, status: "streaming" },
      },
    })
    publishConversationEvent({
      type: "message.updated",
      conversationId,
      payload: updated,
    })
    return Response.json({ ok: true })
  }

  if (kind === "completed") {
    const final = body.finalContent ?? placeholder.content ?? ""
    const updated = await prisma.conversationMessage.update({
      where: { id: turnId },
      data: {
        content: final,
        contentBlocks: { ...currentBlocks, status: "completed" },
      },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    })
    publishConversationEvent({
      type: "message.updated",
      conversationId,
      payload: updated,
    })
    return Response.json({ ok: true })
  }

  if (kind === "failed") {
    const errText = body.error ?? "agent execution failed"
    const updated = await prisma.conversationMessage.update({
      where: { id: turnId },
      data: {
        content: placeholder.content
          ? `${placeholder.content}\n\n[error] ${errText}`
          : `[error] ${errText}`,
        contentBlocks: { ...currentBlocks, status: "failed", error: errText },
      },
    })
    publishConversationEvent({
      type: "message.updated",
      conversationId,
      payload: updated,
    })
    return Response.json({ ok: true })
  }

  return Response.json({ error: "unknown kind" }, { status: 400 })
}
