/**
 * POST /api/runtimes/token — generate a one-time daemon setup token
 *
 * Stores the token in UserCredentials.daemonSetupToken.
 * The daemon reads it during `charclaw setup` and the register route nulls it after use.
 */

import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError } from "@/lib/shared/api-helpers"

export async function POST() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const token = randomBytes(24).toString("hex")

  await prisma.userCredentials.upsert({
    where: { userId: auth.userId },
    update: { daemonSetupToken: token },
    create: { userId: auth.userId, daemonSetupToken: token },
  })

  return Response.json({ token })
}
