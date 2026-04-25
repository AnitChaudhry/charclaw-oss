import { describe, it, expect } from "vitest"
import { resolveHref } from "./resolveHref"

describe("resolveHref", () => {
  const slug = "acme"

  it("issue_filter builds a workspace querystring", () => {
    expect(
      resolveHref({ kind: "issue_filter", filter: { status: "in_progress" } }, slug)
    ).toBe("/w/acme/?status=in_progress")
  })

  it("issue_filter with no filter returns bare workspace", () => {
    expect(resolveHref({ kind: "issue_filter", filter: null }, slug)).toBe("/w/acme/")
  })

  it("project prefers targetSlug over targetRef", () => {
    expect(
      resolveHref(
        { kind: "project", targetRef: "id-123", targetSlug: "mobile" },
        slug
      )
    ).toBe("/w/acme/projects/mobile")
  })

  it("project falls back to targetRef if no slug", () => {
    expect(resolveHref({ kind: "project", targetRef: "id-123" }, slug)).toBe(
      "/w/acme/projects/id-123"
    )
  })

  it("conversation links to chat detail", () => {
    expect(resolveHref({ kind: "conversation", targetRef: "conv-1" }, slug)).toBe(
      "/w/acme/chat/conv-1"
    )
  })

  it("url passes through valid https URLs", () => {
    expect(
      resolveHref({ kind: "url", targetRef: "https://example.com/dashboard" }, slug)
    ).toBe("https://example.com/dashboard")
  })

  it("url rejects javascript: URLs (xss guard)", () => {
    expect(
      resolveHref({ kind: "url", targetRef: "javascript:alert(1)" }, slug)
    ).toBe("#")
  })

  it("url rejects non-http protocols", () => {
    expect(resolveHref({ kind: "url", targetRef: "file:///etc/passwd" }, slug)).toBe(
      "#"
    )
  })

  it("unknown kind falls back to workspace root", () => {
    expect(resolveHref({ kind: "unknown-kind" }, slug)).toBe("/w/acme")
  })
})
