/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Parser unit tests. Each agent gets at least one test to lock down the
 * documented happy-path JSON-Lines shape so format drift surfaces as a
 * test failure rather than as silently-empty events.
 */

import { describe, expect, it } from "vitest"

import {
  claudeAgent,
  codexAgent,
  geminiAgent,
  gooseAgent,
  opencodeAgent,
  piAgent,
  mockAgent,
} from "../src/agents/index"
import { emptyParseState, type ParseState } from "../src/core/agent"
import type { Event } from "../src/types/events"

function jsonl(...lines: object[]): string {
  return lines.map(o => JSON.stringify(o)).join("\n") + "\n"
}

function parse(agent: typeof claudeAgent, input: string): { events: Event[]; state: ParseState } {
  return agent.parseEvents(input, emptyParseState())
}

describe("Claude parser", () => {
  it("emits session, token, tool_start, tool_end, end for the documented happy path", () => {
    const input = jsonl(
      { type: "system", subtype: "init", session_id: "sess_abc" },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Reading the file." },
            { type: "tool_use", id: "tu_1", name: "Read", input: { path: "src/foo.ts" } },
          ],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "tu_1", content: "file contents" },
          ],
        },
      },
      { type: "result", subtype: "success", is_error: false },
    )

    const { events } = parse(claudeAgent, input)
    const types = events.map(e => e.type)
    expect(types).toContain("session")
    expect(types).toContain("token")
    expect(types).toContain("tool_start")
    expect(types).toContain("tool_end")
    expect(types).toContain("end")

    const sessionEvent = events.find(e => e.type === "session")
    expect(sessionEvent).toMatchObject({ type: "session", id: "sess_abc" })

    const token = events.find(e => e.type === "token")
    expect(token).toMatchObject({ type: "token", text: "Reading the file." })

    const toolStart = events.find(e => e.type === "tool_start")
    expect(toolStart).toMatchObject({ type: "tool_start", name: "read", id: "tu_1" })

    const toolEnd = events.find(e => e.type === "tool_end")
    expect(toolEnd).toMatchObject({ type: "tool_end", id: "tu_1", name: "read", output: "file contents" })

    const end = events.find(e => e.type === "end")
    expect(end).toMatchObject({ type: "end" })
    expect((end as { error?: string }).error).toBeUndefined()
  })

  it("flags is_error and non-success subtypes on the end event", () => {
    const input = jsonl(
      { type: "result", subtype: "error_max_turns", is_error: true },
    )
    const { events } = parse(claudeAgent, input)
    const end = events.find(e => e.type === "end") as { type: "end"; error?: string }
    expect(end?.error).toBe("error_max_turns")
  })

  it("handles partial trailing line by buffering until the next call", () => {
    // Split the second JSON line mid-word at "assi" so concatenation
    // produces the correct string when the next slice arrives.
    const fullSecond = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "there." }] },
    })
    const cut = '{"type":"assi'.length
    const head = fullSecond.slice(0, cut) // `{"type":"assi`
    const tail = fullSecond.slice(cut)    // `stant","message":...`

    const slice1 =
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Hi " }] } }) +
      "\n" +
      head // truncated mid-line, no trailing newline
    const r1 = claudeAgent.parseEvents(slice1, emptyParseState())
    expect(r1.events.filter(e => e.type === "token")).toHaveLength(1)
    expect(r1.state.buffer).toBe(head)

    // Second slice: rest of the JSON + newline.
    const slice2 = tail + "\n"
    const r2 = claudeAgent.parseEvents(slice2, r1.state)
    expect(r2.events.filter(e => e.type === "token").map(e => (e as { text: string }).text)).toEqual(["there."])
  })
})

describe("Codex parser", () => {
  it("emits token from agent_message_delta + end on completion", () => {
    const input = jsonl(
      { type: "agent_message_delta", delta: "Hello, " },
      { type: "agent_message_delta", delta: "world." },
      { type: "task_complete" },
    )
    const { events } = parse(codexAgent, input)
    const tokens = events.filter(e => e.type === "token").map(e => (e as { text: string }).text)
    expect(tokens.join("")).toBe("Hello, world.")
    expect(events.find(e => e.type === "end")).toBeTruthy()
  })

  it("emits tool_start/tool_end for tool_use/tool_result", () => {
    const input = jsonl(
      { type: "tool_use", tool_name: "shell", arguments: { command: "ls" } },
      { type: "tool_result", output: "foo bar" },
    )
    const { events } = parse(codexAgent, input)
    expect(events.find(e => e.type === "tool_start")).toMatchObject({ name: "shell" })
    expect(events.find(e => e.type === "tool_end")).toMatchObject({ output: "foo bar" })
  })
})

describe("Gemini parser", () => {
  it("emits token + end for delta/done shape", () => {
    const input = jsonl(
      { type: "text_delta", delta: "Answer." },
      { type: "done" },
    )
    const { events } = parse(geminiAgent, input)
    expect(events.find(e => e.type === "token")).toMatchObject({ text: "Answer." })
    expect(events.find(e => e.type === "end")).toBeTruthy()
  })
})

describe("Goose parser", () => {
  it("falls back to raw line as token when JSON parse fails", () => {
    const input = "Plain text from goose\n"
    const { events } = parse(gooseAgent, input)
    expect(events.find(e => e.type === "token")).toMatchObject({ text: "Plain text from goose\n" })
  })
})

describe("OpenCode parser", () => {
  it("emits token and end", () => {
    const input = jsonl(
      { type: "text", text: "hello" },
      { type: "done" },
    )
    const { events } = parse(opencodeAgent, input)
    expect(events.find(e => e.type === "token")).toMatchObject({ text: "hello" })
    expect(events.find(e => e.type === "end")).toBeTruthy()
  })
})

describe("Pi parser", () => {
  it("emits token from delta and end on done", () => {
    const input = jsonl(
      { type: "delta", text: "pi here" },
      { type: "done" },
    )
    const { events } = parse(piAgent, input)
    expect(events.find(e => e.type === "token")).toMatchObject({ text: "pi here" })
    expect(events.find(e => e.type === "end")).toBeTruthy()
  })
})

describe("Mock parser", () => {
  it("round-trips token + end emitted by the inline mock command", () => {
    const input = jsonl(
      { type: "token", text: "echo: hi" },
      { type: "end" },
    )
    const { events } = parse(mockAgent, input)
    expect(events.map(e => e.type)).toEqual(["token", "end"])
  })
})

describe("Tool name normalization (cross-agent)", () => {
  it("Claude collapses Bash/Read/Edit/Glob/Grep to canonical names", () => {
    const input = jsonl(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "1", name: "Bash", input: {} },
            { type: "tool_use", id: "2", name: "Read", input: {} },
            { type: "tool_use", id: "3", name: "Edit", input: {} },
            { type: "tool_use", id: "4", name: "Glob", input: {} },
            { type: "tool_use", id: "5", name: "Grep", input: {} },
          ],
        },
      },
    )
    const { events } = parse(claudeAgent, input)
    const names = events.filter(e => e.type === "tool_start").map(e => (e as { name: string }).name)
    expect(names).toEqual(["shell", "read", "edit", "glob", "grep"])
  })
})
