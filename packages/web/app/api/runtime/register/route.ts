/**
 * POST /api/runtime/register
 * Called by the daemon during `charclaw setup`.
 * Validates the one-time setup token, creates a Runtime record, returns daemonToken.
 *
 * The runtime is attached to the user's active (personal) workspace by
 * default. A future phase can let the daemon pass an explicit
 * workspaceSlug if desktop teams share a machine.
 */

import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db/prisma"
import { badRequest } from "@/lib/shared/api-helpers"
import { getActiveWorkspace } from "@/lib/auth/workspace"

export async function POST(req: Request) {
  const body = await req.json()
  const { setupToken, name, workspaceRoot, capabilities } = body

  if (!setupToken || !name || !workspaceRoot) {
    return badRequest("Missing required fields: setupToken, name, workspaceRoot")
  }

  // Validate setup token — stored in UserCredentials as a one-time token
  const credential = await prisma.userCredentials.findFirst({
    where: { daemonSetupToken: setupToken },
    select: { userId: true, id: true },
  })

  if (!credential) {
    return Response.json({ error: "Invalid or expired setup token" }, { status: 401 })
  }

  const workspace = await getActiveWorkspace(credential.userId)
  if (!workspace) {
    return Response.json(
      { error: "No workspace found for user — sign in on the web to provision one" },
      { status: 500 }
    )
  }

  // Issue a long-lived daemon token
  const daemonToken = `daemon_${randomBytes(32).toString("hex")}`

  const runtime = await prisma.runtime.create({
    data: {
      userId: credential.userId,
      workspaceId: workspace.id,
      name,
      kind: "local",
      status: "online",
      workspaceRoot,
      capabilities,
      lastHeartbeat: new Date(),
      daemonToken,
    },
  })

  // Invalidate the one-time setup token
  await prisma.userCredentials.update({
    where: { id: credential.id },
    data: { daemonSetupToken: null },
  })

  return Response.json({ runtimeId: runtime.id, daemonToken })
}
