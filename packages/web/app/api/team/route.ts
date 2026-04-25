/**
 * Legacy compatibility shim — /api/team/** has moved to /api/workspace/**.
 *
 * Returns a 308 Permanent Redirect so callers (including the desktop app
 * and bookmarked CLI usage) preserve method + body on the retry. Will be
 * removed after all first-party clients migrate.
 */
import { NextRequest, NextResponse } from "next/server"

function redirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = url.pathname.replace(/^\/api\/team/, "/api/workspace")
  return NextResponse.redirect(url, 308)
}

export const GET = redirect
export const POST = redirect
export const DELETE = redirect
export const PATCH = redirect
export const PUT = redirect
