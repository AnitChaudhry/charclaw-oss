/**
 * GET /api/runtime/status?runtimeId=...
 * Returns current status for the daemon's `charclaw status` command.
 */

import { prisma } from "@/lib/db/prisma"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"

export async function GET(req: Request) {
  const auth = await requireDaemonAuth(req)
  if (auth instanceof Response) return auth

  const runtime = await prisma.runtime.findUnique({
    where: { id: auth.runtimeId },
    select: { status: true, lastHeartbeat: true, name: true, capabilities: true },
  })

  if (!runtime) return Response.json({ error: "Runtime not found" }, { status: 404 })

  return Response.json({
    status: runtime.status,
    lastHeartbeat: runtime.lastHeartbeat,
    name: runtime.name,
    capabilities: runtime.capabilities,
  })
}
