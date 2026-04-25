import { Daytona, DaytonaNotFoundError, type Sandbox as DaytonaSandbox } from "@daytonaio/sdk"
import { adaptDaytonaSandbox, createLocalSandbox, localWorkdir } from "@charclaw/agents"
import type { CodeAgentSandbox } from "@charclaw/agents"
import { readPersistedSessionId } from "@/lib/agents/agent-session"
import { SANDBOX_CONFIG } from "@/lib/shared/constants"
import { prisma } from "@/lib/db/prisma"
import { buildMcpConfig, getMcpConfigWriteCommand } from "@/lib/mcp/mcp-config"
import { decrypt } from "@/lib/auth/encryption"
import type { Agent } from "@/lib/shared/types"
import { setupClaudeHooks } from "@/lib/agents/claude-hooks"
import { OPENCODE_PERMISSION_ENV } from "@/lib/agents/opencode-permissions"
import { setupCodexRules } from "@/lib/agents/codex-rules"
import { getEnvForModel } from "@charclaw/common"

/**
 * Error thrown when a sandbox is not found in Daytona but exists in the database.
 * Indicates it was deleted externally and needs to be recreated.
 */
export class SandboxNotFoundError extends Error {
  constructor(public sandboxId: string) {
    super(`Sandbox ${sandboxId} not found — it may have been deleted`)
    this.name = "SandboxNotFoundError"
  }
}

async function getRepoEnvVars(repoId?: string): Promise<Record<string, string>> {
  if (!repoId) return {}
  try {
    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { envVars: true },
    })
    if (!repo?.envVars) return {}
    const encrypted = repo.envVars as Record<string, string>
    const result: Record<string, string> = {}
    for (const [key, val] of Object.entries(encrypted)) {
      try { result[key] = decrypt(val) } catch { /* skip bad keys */ }
    }
    return result
  } catch {
    return {}
  }
}

/** Context for resolving a local runtime. */
export interface LocalRuntimeContext {
  runtimeId: string
  workspaceRoot: string
  branchName: string
  repoOwner: string
  repoName: string
}

/**
 * Ensures a sandbox (Daytona or local) is ready for agent execution.
 *
 * Pass `localCtx` when the sandbox belongs to a local runtime. In that case
 * `daytonaApiKey` and `sandboxId` are ignored.
 */
export async function ensureSandboxReady(
  daytonaApiKey: string,
  sandboxId: string,
  repoName: string,
  previewUrlPattern?: string,
  anthropicApiKey?: string,
  anthropicAuthType?: string,
  anthropicAuthToken?: string,
  databaseSessionId?: string,
  databaseSessionAgent?: string,
  openaiApiKey?: string,
  agent?: Agent,
  model?: string,
  opencodeApiKey?: string,
  repoId?: string,
  geminiApiKey?: string,
  /** Pass to use local machine instead of Daytona */
  localCtx?: LocalRuntimeContext
): Promise<{
  sandbox: CodeAgentSandbox
  wasResumed: boolean
  resumeSessionId?: string
  env: Record<string, string>
}> {
  let t0 = Date.now()
  let sandbox: CodeAgentSandbox

  if (localCtx) {
    // ── Local runtime path ────────────────────────────────────────────────
    const cwd = localWorkdir(
      localCtx.workspaceRoot,
      localCtx.repoOwner,
      localCtx.repoName,
      localCtx.branchName
    )
    sandbox = createLocalSandbox({ cwd })
    console.log(`[ensureSandboxReady] local sandbox resolved in ${Date.now() - t0}ms, cwd=${cwd}`)
  } else {
    // ── Daytona path ──────────────────────────────────────────────────────
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    let daySandbox
    try {
      daySandbox = await daytona.get(sandboxId)
    } catch (error) {
      if (error instanceof DaytonaNotFoundError) {
        throw new SandboxNotFoundError(sandboxId)
      }
      throw error
    }
    console.log(`[ensureSandboxReady] daytona.get took ${Date.now() - t0}ms`)

    if (daySandbox.state !== "started") {
      t0 = Date.now()
      await daySandbox.start(SANDBOX_CONFIG.START_TIMEOUT_SECONDS)
      console.log(`[ensureSandboxReady] sandbox.start took ${Date.now() - t0}ms`)
    }
    sandbox = adaptDaytonaSandbox(daySandbox)
  }

  // ── Session ID resolution (shared between local and Daytona) ─────────────
  // setupClaudeHooks / setupCodexRules reach into Daytona's native
  // sandbox.process.* and sandbox.fs.* APIs, which don't exist on the
  // local CodeAgentSandbox wrapper. Skip them in local mode; local users
  // can drop the same hook/rules files into their working directory
  // manually if they want that behavior.
  t0 = Date.now()
  const fileSessionId = await readPersistedSessionId(
    localCtx ? sandbox : (sandbox as unknown as DaytonaSandbox),
  )
  console.log(`[ensureSandboxReady] readPersistedSessionId took ${Date.now() - t0}ms`)
  const sameAgent = !databaseSessionAgent || databaseSessionAgent === agent
  const resumeSessionId = sameAgent ? (fileSessionId || databaseSessionId) : undefined

  // ── Agent-specific setup (Daytona-only; local skips) ─────────────────────
  if (!localCtx) {
    const sbAsDaytona = sandbox as unknown as DaytonaSandbox
    if (agent === "claude-code" || !agent) {
      t0 = Date.now()
      await setupClaudeHooks(sbAsDaytona)
      console.log(`[ensureSandboxReady] claude hooks written, took ${Date.now() - t0}ms`)
    }
    if (agent === "codex") {
      t0 = Date.now()
      await setupCodexRules(sbAsDaytona)
      console.log(`[ensureSandboxReady] codex rules written, took ${Date.now() - t0}ms`)
    }
  } else {
    console.log(`[ensureSandboxReady] local runtime — skipping Daytona-only hooks/rules`)
  }

  // ── MCP config ────────────────────────────────────────────────────────────
  if (repoId && agent && agent !== "opencode") {
    t0 = Date.now()
    try {
      const mcpServers = await prisma.repoMcpServer.findMany({
        where: { repoId, status: "connected" },
        select: { slug: true, name: true, url: true, accessToken: true, refreshToken: true },
      })
      if (mcpServers.length > 0) {
        const { configPath, configContent, configDir } = buildMcpConfig(mcpServers, agent)
        if (configContent) {
          const mcpCommand = getMcpConfigWriteCommand(configDir, configPath, configContent, agent)
          await sandbox.executeCommand?.(mcpCommand)
          console.log(`[ensureSandboxReady] MCP config (${mcpServers.length} servers) took ${Date.now() - t0}ms`)
        }
      }
    } catch (err) {
      console.error("[ensureSandboxReady] Failed to write MCP config:", err)
    }
  }

  // ── Environment variables ─────────────────────────────────────────────────
  const apiKeyEnv = getEnvForModel(model, agent, {
    anthropicApiKey,
    anthropicAuthToken,
    openaiApiKey,
    opencodeApiKey,
    geminiApiKey,
  })
  const repoEnv = await getRepoEnvVars(repoId)
  const env: Record<string, string> = { ...repoEnv, ...apiKeyEnv }

  if (agent === "opencode") {
    env.OPENCODE_PERMISSION = OPENCODE_PERMISSION_ENV
  }

  return {
    sandbox,
    wasResumed: !!resumeSessionId,
    resumeSessionId,
    env,
  }
}

/**
 * Lighter version — ensures a sandbox is started.
 * Used for git/SSH operations that don't need the full agent context.
 * Returns null for local runtimes (no start needed).
 */
export async function ensureSandboxStarted(
  daytonaApiKey: string,
  sandboxId: string,
  localCtx?: LocalRuntimeContext
): Promise<CodeAgentSandbox | null> {
  if (localCtx) {
    const cwd = localWorkdir(
      localCtx.workspaceRoot,
      localCtx.repoOwner,
      localCtx.repoName,
      localCtx.branchName
    )
    return createLocalSandbox({ cwd })
  }

  const daySandbox = await ensureDaytonaStarted(daytonaApiKey, sandboxId)
  return daySandbox ? adaptDaytonaSandbox(daySandbox) : null
}

/**
 * Same as `ensureSandboxStarted` but returns the raw Daytona SDK Sandbox
 * object (not the wrapper). Use this from routes that reach for
 * Daytona-native APIs like `sandbox.process.executeCommand`.
 *
 * Daytona-only by design — there's no local-runtime fallback because
 * these routes (`app/api/sandbox/{files,git,ssh,terminal}`) predate the
 * local runtime and haven't been ported. Callers who might have a local
 * sandbox should branch on runtime kind before calling this.
 */
export async function ensureDaytonaStarted(
  daytonaApiKey: string,
  sandboxId: string
): Promise<DaytonaSandbox | null> {
  const daytona = new Daytona({ apiKey: daytonaApiKey })
  let daySandbox: DaytonaSandbox
  try {
    daySandbox = await daytona.get(sandboxId)
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) {
      throw new SandboxNotFoundError(sandboxId)
    }
    throw error
  }
  if (daySandbox.state !== "started") {
    await daySandbox.start(SANDBOX_CONFIG.START_TIMEOUT_SECONDS)
  }
  return daySandbox
}
