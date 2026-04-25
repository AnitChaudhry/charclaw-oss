/**
 * Legacy compatibility shim — see /api/team/route.ts.
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
