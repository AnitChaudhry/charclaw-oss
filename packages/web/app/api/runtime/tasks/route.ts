/**
 * GET /api/runtime/tasks?runtimeId=...
 * SSE stream — daemon connects here and receives task assignments in real time.
 * Server pushes a task JSON when an issue is assigned to an agent on this runtime.
 */

import { prisma } from "@/lib/db/prisma"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"
import { activeStreams } from "@/lib/runtime/task-broadcast"

export async function GET(req: Request) {
  const auth = await requireDaemonAuth(req)
  if (auth instanceof Response) return auth
  const { runtimeId } = auth

  // Update runtime to online
  await prisma.runtime.update({
    where: { id: runtimeId },
    data: { status: "online", lastHeartbeat: new Date() },
  })

  const encoder = new TextEncoder()
  let keepAlive: ReturnType<typeof setInterval>

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      activeStreams.set(runtimeId, controller)

      // Ping every 20s to keep connection alive through proxies
      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode("data: ping\n\n"))
      }, 20_000)
    },
    cancel() {
      clearInterval(keepAlive)
      activeStreams.delete(runtimeId)
      // Mark runtime offline when daemon disconnects
      prisma.runtime.update({
        where: { id: runtimeId },
        data: { status: "offline" },
      }).catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
