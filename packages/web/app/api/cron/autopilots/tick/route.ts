/**
 * GET /api/cron/autopilots/tick
 *
 * Scheduler endpoint. Scans autopilots where `enabled = true` and
 * `nextRunAt <= now()`, then fires each via the same path used for
 * manual runs. Returns `{ fired, skipped, failed }`.
 *
 * Auth:
 *   - If AUTOPILOT_CRON_SECRET is set, the caller must include
 *     `Authorization: Bearer <secret>`.
 *   - Otherwise, only localhost calls are accepted (with a warning
 *     logged to stderr).
 */

import { prisma } from "@/lib/db/prisma"
import { fireAutopilot } from "@/lib/autopilots/fire"

function isLocalhost(req: Request): boolean {
  try {
    const url = new URL(req.url)
    const host = url.hostname
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true
    // x-forwarded-for may exist behind a proxy — tolerate only when the
    // header points at a loopback address.
    const xff = req.headers.get("x-forwarded-for")
    if (xff && /^(127\.|::1|localhost)/.test(xff.split(",")[0].trim())) return true
    return false
  } catch {
    return false
  }
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.AUTOPILOT_CRON_SECRET
  if (secret) {
    const header = req.headers.get("authorization") || ""
    return header === `Bearer ${secret}`
  }
  if (isLocalhost(req)) {
    console.warn(
      "[autopilots/tick] AUTOPILOT_CRON_SECRET not set; accepting localhost call"
    )
    return true
  }
  return false
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const due = await prisma.autopilot.findMany({
    where: {
      enabled: true,
      trigger: "cron",
      nextRunAt: { lte: now, not: null },
    },
    select: { id: true },
    take: 100,
  })

  let fired = 0
  let failed = 0
  let skipped = 0
  const results: Array<{ id: string; status: string; issueId: string | null }> = []

  for (const { id } of due) {
    const result = await fireAutopilot(id, { onlyIfDueBefore: now })
    results.push({ id, status: result.status, issueId: result.issueId })
    if (result.status === "succeeded") fired += 1
    else if (result.status === "failed") failed += 1
    else skipped += 1
  }

  return Response.json({ fired, failed, skipped, results })
}
