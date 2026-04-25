/**
 * Resolves the correct CodeAgentSandbox for a given sandbox record.
 * Abstracts the local-machine vs Daytona decision away from callers.
 */

import { Daytona, DaytonaNotFoundError } from "@daytonaio/sdk"
import { adaptDaytonaSandbox } from "@charclaw/agents"
import { createLocalSandbox, localWorkdir } from "@charclaw/agents"
import type { CodeAgentSandbox } from "@charclaw/agents"
import { prisma } from "@/lib/db/prisma"
import { SANDBOX_CONFIG } from "@/lib/shared/constants"

export class SandboxNotFoundError extends Error {
  constructor(public sandboxId: string) {
    super(`Sandbox ${sandboxId} not found — it may have been deleted`)
    this.name = "SandboxNotFoundError"
  }
}

export type RuntimeKind = "local" | "daytona" | "docker" | "ssh"

interface ResolveResult {
  sandbox: CodeAgentSandbox
  kind: RuntimeKind
  /** Local working directory (cwd), set when kind === "local" */
  cwd?: string
  /** Daytona preview URL builder, set when kind === "daytona" */
  previewUrlPattern?: string
}

interface SandboxRef {
  sandboxId: string        // Daytona sandbox ID, or local dir path for local runtimes
  runtimeId?: string | null
  previewUrlPattern?: string | null
  branch?: {
    name: string
    repo: { owner: string; name: string }
  } | null
}

/**
 * Given a sandbox DB record, return a ready CodeAgentSandbox.
 * Handles both local and Daytona runtimes.
 */
export async function resolveRuntime(
  sandboxRef: SandboxRef,
  daytonaApiKey?: string,
  env?: Record<string, string>
): Promise<ResolveResult> {
  // Look up the runtime record if present
  const runtime = sandboxRef.runtimeId
    ? await prisma.runtime.findUnique({ where: { id: sandboxRef.runtimeId } })
    : null

  const kind: RuntimeKind = (runtime?.kind as RuntimeKind) ?? "daytona"

  if (kind === "local") {
    if (!runtime?.workspaceRoot) {
      throw new Error("Local runtime has no workspaceRoot configured")
    }
    const branch = sandboxRef.branch
    if (!branch) throw new Error("Cannot resolve local sandbox without branch info")

    const cwd = localWorkdir(
      runtime.workspaceRoot,
      branch.repo.owner,
      branch.repo.name,
      branch.name
    )

    const sandbox = createLocalSandbox({ cwd, env })
    return { sandbox, kind: "local", cwd }
  }

  // Default: Daytona
  if (!daytonaApiKey) throw new Error("Daytona API key required")
  const daytona = new Daytona({ apiKey: daytonaApiKey })

  let daySandbox
  try {
    daySandbox = await daytona.get(sandboxRef.sandboxId)
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) {
      throw new SandboxNotFoundError(sandboxRef.sandboxId)
    }
    throw error
  }

  if (daySandbox.state !== "started") {
    await daySandbox.start(SANDBOX_CONFIG.START_TIMEOUT_SECONDS)
  }

  const sandbox = adaptDaytonaSandbox(daySandbox, { env })
  return {
    sandbox,
    kind: "daytona",
    previewUrlPattern: sandboxRef.previewUrlPattern ?? undefined,
    // Expose raw daytona object for callers that need Daytona-specific extras
    ...{ _daytona: daySandbox },
  }
}
