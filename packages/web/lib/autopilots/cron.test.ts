import { describe, it, expect } from "vitest"
import { matches, nextRunAfter, describeCron } from "./cron"

describe("cron parser", () => {
  describe("matches", () => {
    it("matches wildcards", () => {
      const at = new Date("2026-04-24T12:30:00Z")
      expect(matches("* * * * *", at, "UTC")).toBe(true)
    })

    it("matches explicit minute + hour", () => {
      const at = new Date("2026-04-24T09:00:00Z")
      expect(matches("0 9 * * *", at, "UTC")).toBe(true)
      expect(matches("0 9 * * *", new Date("2026-04-24T09:01:00Z"), "UTC")).toBe(false)
    })

    it("matches day-of-week (Monday=1)", () => {
      // 2026-04-27 is a Monday
      expect(matches("0 9 * * 1", new Date("2026-04-27T09:00:00Z"), "UTC")).toBe(true)
      // 2026-04-28 is a Tuesday
      expect(matches("0 9 * * 1", new Date("2026-04-28T09:00:00Z"), "UTC")).toBe(false)
    })

    it("matches step values", () => {
      const at = new Date("2026-04-24T00:00:00Z")
      expect(matches("*/15 * * * *", at, "UTC")).toBe(true)
      expect(matches("*/15 * * * *", new Date("2026-04-24T00:15:00Z"), "UTC")).toBe(true)
      expect(matches("*/15 * * * *", new Date("2026-04-24T00:07:00Z"), "UTC")).toBe(false)
    })

    it("matches comma lists", () => {
      expect(matches("0 9,17 * * *", new Date("2026-04-24T09:00:00Z"), "UTC")).toBe(true)
      expect(matches("0 9,17 * * *", new Date("2026-04-24T17:00:00Z"), "UTC")).toBe(true)
      expect(matches("0 9,17 * * *", new Date("2026-04-24T13:00:00Z"), "UTC")).toBe(false)
    })
  })

  describe("nextRunAfter", () => {
    it("returns the next Monday 09:00 UTC", () => {
      // Friday 2026-04-24 12:00 UTC → next Monday is 2026-04-27 09:00
      const next = nextRunAfter("0 9 * * 1", new Date("2026-04-24T12:00:00Z"), "UTC")
      expect(next.toISOString()).toBe("2026-04-27T09:00:00.000Z")
    })

    it("advances to the next occurrence of every-15-minutes", () => {
      const next = nextRunAfter("*/15 * * * *", new Date("2026-04-24T12:03:00Z"), "UTC")
      expect(next.toISOString()).toBe("2026-04-24T12:15:00.000Z")
    })
  })

  describe("describeCron", () => {
    it("humanizes common patterns", () => {
      expect(describeCron("0 9 * * 1", "UTC").toLowerCase()).toContain("monday")
      expect(describeCron("*/15 * * * *", "UTC").toLowerCase()).toContain("15")
    })
  })
})
