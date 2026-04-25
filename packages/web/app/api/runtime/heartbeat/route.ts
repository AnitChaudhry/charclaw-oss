/**
 * POST /api/runtime/heartbeat
 * Daemon pings every 25s. Updates lastHeartbeat + capabilities.
 */

import { prisma } from "@/lib/db/prisma"
import { badRequest } from "@/lib/shared/api-helpers"
import { requireDaemonAuth } from "@/lib/runtime/daemon-auth"

export async function POST(req: Request) {
  const auth = await requireDaemonAuth(req)
  if (auth instanceof Response) return auth

  const body = await req.json()
  const { capabilities } = body

  await prisma.runtime.update({
    where: { id: auth.runtimeId },
    data: {
      status: "online",
      lastHeartbeat: new Date(),
      ...(capabilities && { capabilities }),
    },
  })

  return Response.json({ ok: true })
}
