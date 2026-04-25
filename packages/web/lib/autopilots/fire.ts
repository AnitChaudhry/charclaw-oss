/**
 * Shared logic for firing an Autopilot — invoked both by manual-run and
 * the cron tick endpoint. Creates an AutopilotRun row, then attempts to
 * create an Issue from the autopilot's templates, then settles the run
 * as `succeeded` or `failed`. Recomputes nextRunAt for cron triggers.
 */

import { prisma } from "@/lib/db/prisma"
import type { Autopilot } from "@prisma/client"
import { nextRunAfter } from "./cron"

export interface FireOptions {
  /** If true, also update lastRunAt + recompute nextRunAt for cron triggers. */
  advanceSchedule?: boolean
  /** Optional cutoff — if now is before this, we skip. Only used by tick. */
  onlyIfDueBefore?: Date
}

export interface FireResult {
  status: "succeeded" | "failed" | "skipped"
  runId: string | null
  issueId: string | null
  error: string | null
}

/**
 * Substitute `{var}` tokens inside a template string. Unknown tokens
 * are left untouched (useful for curly-brace-heavy bodies). Supported
 * tokens: `{date}`, `{datetime}`, `{time}`, `{autopilotName}`.
 */
export function applyTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole
  })
}

function buildTemplateVars(autopilot: Pick<Autopilot, "name" | "timezone">, now: Date): Record<string, string> {
  // Use the autopilot's tz for human-friendly {date}/{time}.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: autopilot.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: autopilot.timezone || "UTC",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  })
  return {
    date: fmt.format(now),
    time: timeFmt.format(now),
    datetime: `${fmt.format(now)} ${timeFmt.format(now)}`,
    autopilotName: autopilot.name,
  }
}

/**
 * Fire a single autopilot. Safe to call concurrently only if callers
 * ensure they hold the row (e.g. by optimistically bumping nextRunAt
 * first). We do not lock explicitly here.
 */
export async function fireAutopilot(
  autopilotId: string,
  opts: FireOptions = {}
): Promise<FireResult> {
  const autopilot = await prisma.autopilot.findUnique({
    where: { id: autopilotId },
  })
  if (!autopilot) {
    return { status: "failed", runId: null, issueId: null, error: "Autopilot not found" }
  }

  if (opts.onlyIfDueBefore && (!autopilot.nextRunAt || autopilot.nextRunAt > opts.onlyIfDueBefore)) {
    return { status: "skipped", runId: null, issueId: null, error: null }
  }

  const run = await prisma.autopilotRun.create({
    data: { autopilotId, status: "pending" },
  })

  const now = new Date()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = (autopilot.config ?? {}) as any
    const titleTemplate: string =
      typeof cfg.titleTemplate === "string" && cfg.titleTemplate.trim()
        ? cfg.titleTemplate
        : `Autopilot: ${autopilot.name}`
    const bodyTemplate: string =
      typeof cfg.bodyTemplate === "string" ? cfg.bodyTemplate : ""
    const priority: number =
      typeof cfg.priority === "number" ? cfg.priority : 0

    const vars = buildTemplateVars(autopilot, now)
    const title = applyTemplate(titleTemplate, vars)
    const body = applyTemplate(bodyTemplate, vars)

    const issue = await prisma.issue.create({
      data: {
        userId: autopilot.createdByUserId,
        workspaceId: autopilot.workspaceId,
        title,
        body: body || null,
        priority,
        status: "backlog",
        assigneeAgentId: autopilot.agentProfileId ?? null,
      },
    })

    // Log a creation event so there's a trace the issue came from an autopilot.
    try {
      await prisma.issueEvent.create({
        data: {
          issueId: issue.id,
          kind: "autopilot_fired",
          payload: { autopilotId: autopilot.id, runId: run.id },
        },
      })
    } catch {
      // Non-fatal — event logging shouldn't block firing.
    }

    await prisma.autopilotRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        issueId: issue.id,
        finishedAt: new Date(),
      },
    })

    if (opts.advanceSchedule !== false) {
      let nextRunAt: Date | null = null
      if (autopilot.trigger === "cron" && autopilot.schedule) {
        try {
          nextRunAt = nextRunAfter(
            autopilot.schedule,
            now,
            autopilot.timezone || "UTC"
          )
        } catch {
          nextRunAt = null
        }
      }
      await prisma.autopilot.update({
        where: { id: autopilot.id },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      })
    }

    return {
      status: "succeeded",
      runId: run.id,
      issueId: issue.id,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.autopilotRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
      },
    })

    // Still advance schedule so a single failure doesn't stall the autopilot.
    if (opts.advanceSchedule !== false && autopilot.trigger === "cron" && autopilot.schedule) {
      try {
        const nextRunAt = nextRunAfter(
          autopilot.schedule,
          now,
          autopilot.timezone || "UTC"
        )
        await prisma.autopilot.update({
          where: { id: autopilot.id },
          data: { lastRunAt: now, nextRunAt },
        })
      } catch {
        // ignore; leaving nextRunAt stale will let operators notice the drift
      }
    }

    return { status: "failed", runId: run.id, issueId: null, error: message }
  }
}
