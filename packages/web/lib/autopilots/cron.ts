/**
 * Minimal cron-expression helpers for the Autopilots feature.
 *
 * Supports the 5-field form: `m h d mon dow`.
 *   m   — minute (0-59)
 *   h   — hour (0-23)
 *   d   — day of month (1-31)
 *   mon — month (1-12)
 *   dow — day of week (0-6, where 0 = Sunday)
 *
 * Per field, the following syntax is supported:
 *   *         — any value
 *   n         — literal value
 *   a-b       — inclusive range
 *   a,b,c     — list of values / ranges
 *   * / n     — step (every n), with * or a-b base
 *
 * Timezone handling uses Intl.DateTimeFormat so we avoid a dep like
 * date-fns-tz or luxon. We convert the absolute instant `after` into the
 * wall-clock parts of the target tz, advance minute-by-minute until we
 * find a match, and then convert back to a UTC Date.
 *
 * Seconds are intentionally skipped — every computed instant has second
 * and millisecond = 0.
 *
 * `cron-parser` is NOT in packages/web/package.json (checked 2026-04-24)
 * so this file provides a small hand-rolled implementation instead. Keep
 * the scope minimal: we only need `nextRunAfter` and `matches`.
 */

export interface ParsedCron {
  minute: Set<number>
  hour: Set<number>
  dom: Set<number>
  month: Set<number>
  dow: Set<number>
  /** True when both dom and dow are restricted (cron convention: OR instead of AND). */
  domDowBothRestricted: boolean
}

const FIELD_RANGES: Array<{ name: string; min: number; max: number }> = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "dom", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "dow", min: 0, max: 6 },
]

function parseField(
  raw: string,
  min: number,
  max: number,
  fieldName: string
): Set<number> {
  const result = new Set<number>()
  const parts = raw.split(",")
  for (const partRaw of parts) {
    const part = partRaw.trim()
    if (!part) throw new Error(`Invalid ${fieldName} field: empty segment`)

    let step = 1
    let base = part
    const slashIdx = part.indexOf("/")
    if (slashIdx >= 0) {
      base = part.slice(0, slashIdx)
      const stepStr = part.slice(slashIdx + 1)
      step = Number(stepStr)
      if (!Number.isInteger(step) || step <= 0) {
        throw new Error(`Invalid ${fieldName} step: ${stepStr}`)
      }
    }

    let rangeStart: number
    let rangeEnd: number
    if (base === "*" || base === "") {
      rangeStart = min
      rangeEnd = max
    } else if (base.includes("-")) {
      const [a, b] = base.split("-")
      rangeStart = Number(a)
      rangeEnd = Number(b)
      if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd)) {
        throw new Error(`Invalid ${fieldName} range: ${base}`)
      }
    } else {
      const n = Number(base)
      if (!Number.isInteger(n)) {
        throw new Error(`Invalid ${fieldName} value: ${base}`)
      }
      // A bare number with a step implies "n, n+step, n+2step, ..., max".
      rangeStart = n
      rangeEnd = slashIdx >= 0 ? max : n
    }

    if (rangeStart < min || rangeEnd > max || rangeStart > rangeEnd) {
      throw new Error(
        `Invalid ${fieldName} range: ${base} (must be within ${min}-${max})`
      )
    }

    for (let v = rangeStart; v <= rangeEnd; v += step) result.add(v)
  }
  return result
}

/**
 * Parse a 5-field cron expression. Throws on invalid input.
 */
export function parseCron(expr: string): ParsedCron {
  const trimmed = expr.trim().replace(/\s+/g, " ")
  const tokens = trimmed.split(" ")
  if (tokens.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields (m h d mon dow), got ${tokens.length}`
    )
  }
  const [mT, hT, domT, monT, dowT] = tokens
  const parsed: ParsedCron = {
    minute: parseField(mT, FIELD_RANGES[0].min, FIELD_RANGES[0].max, "minute"),
    hour: parseField(hT, FIELD_RANGES[1].min, FIELD_RANGES[1].max, "hour"),
    dom: parseField(domT, FIELD_RANGES[2].min, FIELD_RANGES[2].max, "dom"),
    month: parseField(monT, FIELD_RANGES[3].min, FIELD_RANGES[3].max, "month"),
    dow: parseField(dowT, FIELD_RANGES[4].min, FIELD_RANGES[4].max, "dow"),
    domDowBothRestricted: domT !== "*" && dowT !== "*",
  }
  return parsed
}

// -----------------------------------------------------------------------------
// Timezone conversion helpers.
//
// Strategy: use Intl.DateTimeFormat with the target timezone to read the
// wall-clock parts (y, mo, d, h, m, s, dow) of a given UTC instant. For
// the reverse direction we use an iterative fixup: construct a UTC date
// from the desired wall parts, compute what wall parts that UTC date
// corresponds to in the tz, and adjust by the difference.
// -----------------------------------------------------------------------------

interface WallParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 0=Sun..6=Sat
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function getPartsInTz(date: Date, tz: string): WallParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  })
  const parts = fmt.formatToParts(date)
  const bag: Record<string, string> = {}
  for (const p of parts) bag[p.type] = p.value

  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAY_INDEX[bag.weekday] ?? 0,
  }
}

/**
 * Build a UTC Date whose wall-clock representation in `tz` matches the
 * given parts. We iterate up to three times to converge across DST.
 */
function wallPartsToUtc(parts: Omit<WallParts, "weekday">, tz: string): Date {
  // Initial guess: treat the wall parts as if they were UTC.
  let guess = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    )
  )
  for (let i = 0; i < 3; i++) {
    const seen = getPartsInTz(guess, tz)
    const seenMs = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      seen.second
    )
    const wantedMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    const diff = wantedMs - seenMs
    if (diff === 0) break
    guess = new Date(guess.getTime() + diff)
  }
  return guess
}

function partsMatch(expr: ParsedCron, w: WallParts): boolean {
  if (!expr.minute.has(w.minute)) return false
  if (!expr.hour.has(w.hour)) return false
  if (!expr.month.has(w.month)) return false
  const domOk = expr.dom.has(w.day)
  const dowOk = expr.dow.has(w.weekday)
  // Cron quirk: when both dom and dow are restricted, it's an OR not AND.
  if (expr.domDowBothRestricted) return domOk || dowOk
  return domOk && dowOk
}

/**
 * Does `at` match the cron expression in the given tz?
 */
export function matches(expr: string, at: Date, tz: string): boolean {
  const parsed = parseCron(expr)
  const w = getPartsInTz(at, tz)
  return partsMatch(parsed, w)
}

/**
 * Compute the next firing time strictly after `after`, in `tz`.
 *
 * Implementation: start from `after` rounded up to the next whole minute
 * and step forward one minute at a time until we hit a match. We bound
 * the search to ~4 years (roughly max interval for reasonable exprs).
 */
export function nextRunAfter(expr: string, after: Date, tz: string): Date {
  const parsed = parseCron(expr)

  // Start one minute past `after`, floored to the minute boundary.
  const startMs = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000
  let cur = new Date(startMs)

  const maxIterations = 60 * 24 * 366 * 4 // ~4 years of minutes
  for (let i = 0; i < maxIterations; i++) {
    const w = getPartsInTz(cur, tz)
    if (partsMatch(parsed, w)) {
      // Align to exact wall-clock minute in tz (drops any residual seconds).
      return wallPartsToUtc(
        {
          year: w.year,
          month: w.month,
          day: w.day,
          hour: w.hour,
          minute: w.minute,
          second: 0,
        },
        tz
      )
    }
    cur = new Date(cur.getTime() + 60_000)
  }
  throw new Error(`No match found for cron '${expr}' within 4 years`)
}

/**
 * Produce a best-effort English description of a cron expression. Falls
 * back to the raw expression for forms we don't specifically describe.
 */
export function describeCron(expr: string, tz = "UTC"): string {
  let parsed: ParsedCron
  try {
    parsed = parseCron(expr)
  } catch {
    return expr
  }
  const tokens = expr.trim().split(/\s+/)
  const [m, h, dom, mon, dow] = tokens

  const isEvery = (field: string, size: number) =>
    field === "*" || parsed[field === m ? "minute" : field === h ? "hour" : field === dom ? "dom" : field === mon ? "month" : "dow"].size === size

  // every N minutes
  if (/^\*\/\d+$/.test(m) && h === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = Number(m.split("/")[1])
    return `Every ${n} minute${n === 1 ? "" : "s"}`
  }
  // hourly on minute
  if (/^\d+$/.test(m) && h === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every hour at :${m.padStart(2, "0")}`
  }
  // daily at time
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && mon === "*" && dow === "*") {
    return `Daily at ${h.padStart(2, "0")}:${m.padStart(2, "0")} ${tz}`
  }
  // weekly on a given dow
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && mon === "*" && /^\d+$/.test(dow)) {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return `Every ${names[Number(dow)]} at ${h.padStart(2, "0")}:${m.padStart(2, "0")} ${tz}`
  }
  // monthly on a given dom
  if (/^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom) && mon === "*" && dow === "*") {
    return `Day ${dom} of every month at ${h.padStart(2, "0")}:${m.padStart(2, "0")} ${tz}`
  }
  void isEvery // reserved for future humanizations
  return `cron(${expr}) ${tz}`
}

