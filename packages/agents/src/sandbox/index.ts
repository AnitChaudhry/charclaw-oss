/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type {
  AdaptSandboxOptions,
  CodeAgentSandbox,
} from "../types/provider.js"

export { adaptDaytonaSandbox } from "./daytona.js"
export { createLocalSandbox, localWorkdir } from "./local.js"
export type { LocalSandboxOptions } from "./local.js"

/**
 * Generic adapter entry point. Today this just forwards to the Daytona
 * adapter, but reserves a single name in case future sandbox types want
 * to dispatch through it.
 */
export async function adaptSandbox(
  sandbox: unknown,
  options: AdaptSandboxOptions = {},
): Promise<CodeAgentSandbox> {
  const { adaptDaytonaSandbox } = await import("./daytona.js")
  // The Daytona Sandbox shape is opaque to consumers; runtime checks are
  // not meaningful here, so we trust the caller's typing.
  return adaptDaytonaSandbox(sandbox as never, options)
}
