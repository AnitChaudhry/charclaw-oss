import { describe, it, expect } from "vitest"
import { parseMentions } from "./parse"

describe("parseMentions", () => {
  it("extracts a single @handle", () => {
    const out = parseMentions("Hi @alice, can you review?")
    expect(out).toHaveLength(1)
    expect(out[0].handle).toBe("alice")
  })

  it("extracts multiple distinct handles", () => {
    const out = parseMentions("cc @alice @bob thanks")
    const handles = out.map((m) => m.handle).sort()
    expect(handles).toEqual(["alice", "bob"])
  })

  it("ignores email-like tokens (no @ at word boundary)", () => {
    const out = parseMentions("reach me at user@example.com")
    expect(out).toHaveLength(0)
  })

  it("handles @ at start of string", () => {
    const out = parseMentions("@alice please do X")
    expect(out).toHaveLength(1)
    expect(out[0].handle).toBe("alice")
  })

  it("ignores bare @ without handle", () => {
    const out = parseMentions("price is @ $10")
    expect(out).toHaveLength(0)
  })

  it("supports hyphenated and underscore handles", () => {
    const out = parseMentions("ping @chat-bot and @code_reviewer")
    const handles = out.map((m) => m.handle).sort()
    expect(handles).toEqual(["chat-bot", "code_reviewer"])
  })

  it("captures index for each match", () => {
    const out = parseMentions("@a then @b")
    expect(out[0].index).toBe(0)
    expect(out[1].index).toBeGreaterThan(out[0].index)
  })
})
