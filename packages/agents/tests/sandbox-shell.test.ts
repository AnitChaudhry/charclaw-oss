/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 *
 * Sandbox shell-quoting + env-prefixing tests. These cover the primitives
 * that the Daytona and local sandbox adapters share. A one-character bug
 * here would break command execution silently in production, so test them
 * heavily without needing a real sandbox.
 */

import { describe, it, expect } from "vitest"
import { shellSingleQuote, envExports, withEnv } from "../src/sandbox/shell.js"

describe("shellSingleQuote", () => {
  it("wraps a plain string in single quotes", () => {
    expect(shellSingleQuote("hello")).toBe("'hello'")
  })

  it("escapes embedded single quotes via the standard ' \\'' trick", () => {
    expect(shellSingleQuote("it's")).toBe("'it'\\''s'")
  })

  it("handles strings with shell metacharacters safely", () => {
    expect(shellSingleQuote("foo $BAR `bash` & ; | > <")).toBe(
      "'foo $BAR `bash` & ; | > <'",
    )
  })

  it("handles strings with newlines", () => {
    expect(shellSingleQuote("line1\nline2")).toBe("'line1\nline2'")
  })

  it("handles empty string", () => {
    expect(shellSingleQuote("")).toBe("''")
  })

  it("escapes consecutive single quotes correctly", () => {
    expect(shellSingleQuote("a''b")).toBe("'a'\\'''\\''b'")
  })

  it("handles a value that's literally just a single quote", () => {
    expect(shellSingleQuote("'")).toBe("''\\'''")
  })
})

describe("envExports", () => {
  it("returns empty string for an empty map", () => {
    expect(envExports({})).toBe("")
  })

  it("renders a single export with semicolon terminator", () => {
    expect(envExports({ FOO: "bar" })).toBe("export FOO='bar';")
  })

  it("joins multiple exports with semicolons", () => {
    const out = envExports({ FOO: "bar", BAZ: "qux" })
    expect(out).toContain("export FOO='bar'")
    expect(out).toContain("export BAZ='qux'")
    expect(out.endsWith(";")).toBe(true)
  })

  it("escapes single quotes in values", () => {
    expect(envExports({ KEY: "it's secret" })).toBe(
      "export KEY='it'\\''s secret';",
    )
  })

  it("handles values with shell metacharacters", () => {
    const v = "$INTERPOLATION `cmd` & |"
    expect(envExports({ X: v })).toBe(`export X='${v}';`)
  })

  it("handles long realistic API key shape", () => {
    const v = "sk-ant-oa-AbCdEf123_456-xy_zw"
    expect(envExports({ ANTHROPIC_API_KEY: v })).toBe(
      `export ANTHROPIC_API_KEY='${v}';`,
    )
  })
})

describe("withEnv", () => {
  it("returns the bare command when env is empty", () => {
    expect(withEnv({}, "claude --version")).toBe("claude --version")
  })

  it("prepends env exports + space + command", () => {
    expect(withEnv({ FOO: "bar" }, "echo hi")).toBe("export FOO='bar'; echo hi")
  })

  it("preserves the command body verbatim, including special characters", () => {
    const cmd = "cd /work && claude -p --output-format stream-json -- 'hello'"
    const out = withEnv({ KEY: "v" }, cmd)
    expect(out.endsWith(cmd)).toBe(true)
    expect(out.startsWith("export KEY='v';")).toBe(true)
  })

  it("survives a value containing a single quote without breaking the prefix", () => {
    const out = withEnv({ KEY: "a'b" }, "echo hi")
    // The exports section should be valid: ends with '; ' before the command
    expect(out).toMatch(/^export KEY='a'\\''b'; echo hi$/)
  })
})

describe("integration: env + nohup wrapper shape", () => {
  // This mirrors what daytona.ts does in executeBackground:
  //   envExports + cdPart + opts.command, then wrapped in nohup sh -c '...'.
  // We don't run the command — we just confirm the rendered string is shell-safe.
  it("nohup-wrapped command with env is well-formed", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test", DEBUG: "1" }
    const cwd = "/work/repo with spaces"
    const command = `claude -p --output-format stream-json -- 'hello'`
    const outputFile = "/tmp/out.log"

    const cdPart = `cd ${shellSingleQuote(cwd)} && `
    const wrapped = withEnv(env, `${cdPart}${command}`)
    const inner = shellSingleQuote(
      `${wrapped} >> ${shellSingleQuote(outputFile)} 2>&1; ` +
        `echo done > ${shellSingleQuote(outputFile + ".done")}`,
    )
    const launcher = `nohup sh -c ${inner} > /dev/null 2>&1 & echo $!`

    expect(launcher).toContain("nohup sh -c '")
    expect(launcher.endsWith("> /dev/null 2>&1 & echo $!")).toBe(true)
    // No unescaped single quotes inside the inner '...' wrapper
    const innerBody = launcher.slice("nohup sh -c '".length, launcher.lastIndexOf("' >"))
    // every ' inside should have been escaped to '\''
    const stripped = innerBody.replace(/'\\''/g, "")
    expect(stripped.includes("'")).toBe(false)
  })
})
