/**
 * Validates the daemon Bearer token on incoming runtime API calls.
 */

import { prisma } from "@/lib/db/prisma"

export interface DaemonAuthResult {
  runtimeId: string
  userId: string
}

export async function requireDaemonAuth(req: Request): Promise<DaemonAuthResult | Response> {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = auth.slice(7)
  const runtime = await prisma.runtime.findUnique({
    where: { daemonToken: token },
    select: { id: true, userId: true },
  })
  if (!runtime) {
    return Response.json({ error: "Invalid daemon token" }, { status: 401 })
  }
  return { runtimeId: runtime.id, userId: runtime.userId }
}
