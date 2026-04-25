import { prisma } from "@/lib/db/prisma"
import { ensureSandboxReady, SandboxNotFoundError } from "@/lib/sandbox/sandbox-resume"
import type { LocalRuntimeContext } from "@/lib/sandbox/sandbox-resume"
import { createBackgroundAgentSession } from "@/lib/agents/agent-session"
import {
  requireAuth,
  isAuthError,
  getDaytonaApiKey,
  getSandboxWithAuth,
  resolveUserCredentials,
  badRequest,
  notFound,
  internalError,
  updateSandboxAndBranchStatus,
  resetSandboxStatus,
  getGitHubTokenForUser,
} from "@/lib/shared/api-helpers"
import { PATHS } from "@/lib/shared/constants"
import type { Agent } from "@/lib/shared/types"
import { logActivity } from "@/lib/shared/activity-log"

// Agent execution timeout - 60 seconds (must be literal for Next.js static analysis)
export const maxDuration = 60

export async function POST(req: Request) {
  // 1. Authenticate
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { sandboxId, prompt, previewUrlPattern, repoName, messageId, agent: bodyAgent, model: bodyModel } = body

  if (!sandboxId || !prompt || !messageId) {
    return badRequest("Missing required fields")
  }

  // 2. Verify sandbox belongs to this user
  const sandboxRecord = await getSandboxWithAuth(sandboxId, auth.userId)
  if (!sandboxRecord) {
    return notFound("Sandbox not found")
  }

  // 3. Get credentials — Daytona key optional when using local runtime
  const daytonaApiKey = getDaytonaApiKey()
  const daytonaKeyStr = daytonaApiKey instanceof Response ? "" : daytonaApiKey

  // Resolve user's credentials (uses team owner's Claude subscription if member)
  const { anthropicApiKey, anthropicAuthToken, anthropicAuthType, openaiApiKey, opencodeApiKey, geminiApiKey } =
    await resolveUserCredentials(sandboxRecord.user.credentials, auth.userId)

  // Determine repo name from database or request
  const actualRepoName = repoName || sandboxRecord.branch?.repo?.name || "repo"
  const repoPath = `${PATHS.SANDBOX_HOME}/${actualRepoName}`

  // Resolve agent and model with strict priority — UI body wins, then the
  // persisted branch setting, never a hardcoded default that could silently
  // override what the user picked.
  const validAgents: Agent[] = ["claude-code", "opencode", "codex", "gemini", "goose", "pi", "eliza"]
  const resolvedAgent = validAgents.includes(bodyAgent)
    ? bodyAgent
    : (sandboxRecord.branch?.agent as Agent | undefined)
  if (!resolvedAgent) {
    return badRequest(
      "No agent selected. Pick one in the branch settings or pass 'agent' in the request body.",
    )
  }
  const agent: Agent = resolvedAgent
  const model = bodyModel ?? sandboxRecord.branch?.model ?? undefined

  // Persist agent/model to branch when we used body values so DB stays in sync
  const branchId = sandboxRecord.branch?.id
  if (branchId && (agent !== (sandboxRecord.branch?.agent as Agent) || model !== sandboxRecord.branch?.model)) {
    await prisma.branch.update({
      where: { id: branchId },
      data: { agent, ...(model !== undefined && { model }) },
    })
  }

  // 4. Verify message exists before creating AgentExecution (prevents FK constraint violation)
  const messageRecord = await prisma.message.findUnique({
    where: { id: messageId },
  })
  if (!messageRecord) {
    return notFound("Message not found - it may not have been saved yet")
  }

  // Canonical sandbox ID from DB
  const daytonaSandboxId = sandboxRecord.sandboxId

  // Resolve local runtime context if this sandbox has one
  let localCtx: LocalRuntimeContext | undefined
  if (sandboxRecord.runtimeId) {
    const runtime = await prisma.runtime.findUnique({ where: { id: sandboxRecord.runtimeId } })
    if (runtime?.kind === "local" && runtime.workspaceRoot && sandboxRecord.branch) {
      localCtx = {
        runtimeId: runtime.id,
        workspaceRoot: runtime.workspaceRoot,
        branchName: sandboxRecord.branch.name,
        repoOwner: sandboxRecord.branch.repo.owner,
        repoName: sandboxRecord.branch.repo.name,
      }
    } else if (runtime?.kind === "daytona" && !daytonaKeyStr) {
      return internalError(new Error("Daytona API key required for Daytona runtime"))
    }
  } else if (!daytonaKeyStr) {
    return internalError(new Error("No runtime configured and Daytona API key is missing"))
  }

  try {
    // 5. Ensure sandbox is ready
    let t0 = Date.now()
    const { sandbox, resumeSessionId, env } = await ensureSandboxReady(
      daytonaKeyStr,
      daytonaSandboxId,
      actualRepoName,
      previewUrlPattern || sandboxRecord.previewUrlPattern || undefined,
      anthropicApiKey,
      anthropicAuthType,
      anthropicAuthToken,
      sandboxRecord.sessionId || undefined,
      sandboxRecord.sessionAgent || undefined,
      openaiApiKey,
      agent,
      model,
      opencodeApiKey,
      sandboxRecord.branch?.repo?.id,
      geminiApiKey,
      localCtx
    )
    console.log(`[agent/execute] ensureSandboxReady took ${Date.now() - t0}ms`)

    // 5a. If branch needs sync, pull latest before agent starts
    if (branchId && sandboxRecord.branch?.needsSync) {
      t0 = Date.now()
      const githubToken = await getGitHubTokenForUser(auth.userId)
      if (githubToken) {
        try {
          const owner = sandboxRecord.branch.repo.owner
          const repo = sandboxRecord.branch.repo.name
          const branch = sandboxRecord.branch.name
          const authedUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
          await sandbox.executeCommand?.(
            `cd ${repoPath} && git pull ${authedUrl} ${branch} 2>&1`,
            60
          )
          console.log(`[agent/execute] needsSync pull took ${Date.now() - t0}ms`)
        } catch (err) {
          console.warn(`[agent/execute] needsSync pull failed:`, err)
        }
      }
      await prisma.branch.update({
        where: { id: branchId },
        data: { needsSync: false },
      })
    }

    t0 = Date.now()
    const bgSession = await createBackgroundAgentSession(sandbox, {
      repoPath,
      previewUrlPattern:
        previewUrlPattern || sandboxRecord.previewUrlPattern || undefined,
      sessionId: resumeSessionId,
      agent,
      model,
      env, // Pass env at session creation for setup() (e.g., CLAUDE_CODE_CREDENTIALS)
    })
    console.log(`[agent/execute] createBackgroundAgentSession took ${Date.now() - t0}ms`)

    // 6. Persist session ID so polling can find it, create execution record
    const { backgroundSessionId } = bgSession
    if (sandboxRecord.sessionId !== backgroundSessionId || sandboxRecord.sessionAgent !== agent) {
      await prisma.sandbox.update({
        where: { id: sandboxRecord.id },
        data: { sessionId: backgroundSessionId, sessionAgent: agent },
      })
    }

    const agentExecution = await prisma.agentExecution.upsert({
      where: { messageId },
      update: {
        sandboxId: daytonaSandboxId,
        status: "running",
        completedAt: null,
      },
      create: {
        messageId,
        sandboxId: daytonaSandboxId,
        status: "running",
      },
    })
    console.log(`[agent/execute] Created AgentExecution id=${agentExecution.id} messageId=${messageId} branchId=${branchId || 'unknown'}`)

    // 7. Update sandbox and branch status
    await updateSandboxAndBranchStatus(
      sandboxRecord.id,
      sandboxRecord.branch?.id,
      "running",
      { lastActiveAt: new Date() }
    )

    // 8. Start the turn and write meta before returning (so client polling sees runId/outputFile)
    // Pass env at start() time for freshest credentials (run-level overrides session-level)

    // Detect agent switch: load conversation history for context injection.
    // When the user switches agents mid-conversation, the new CLI has no local
    // session to resume from. We load the full chat history from the DB and
    // inject it into the prompt so the new agent has context.
    const previousAgent = sandboxRecord.sessionAgent
    const isAgentSwitch = !!previousAgent && previousAgent !== agent && !!branchId
    let history: { role: "user" | "assistant"; content: string }[] | undefined

    if (isAgentSwitch) {
      const messages = await prisma.message.findMany({
        where: { branchId },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      })
      history = messages
        .filter((m): m is typeof m & { role: "user" | "assistant" } =>
          (m.role === "user" || m.role === "assistant") && !!m.content.trim()
        )
        .map((m) => ({ role: m.role, content: m.content }))

      if (history.length === 0) history = undefined
      else console.log(`[agent/execute] Agent switch ${previousAgent} → ${agent}: injecting ${history.length} history messages`)
    }

    try {
      await bgSession.start(prompt, { env, ...(history && { history }) })
    } catch (error) {
      console.error("[agent/execute] bgSession.start failed", { messageId }, error)
      try {
        const errMsg = error instanceof Error ? error.message : "Unknown error"
        await prisma.$transaction([
          prisma.agentExecution.update({
            where: { id: agentExecution.id },
            data: { status: "error", completedAt: new Date() },
          }),
          prisma.message.update({
            where: { id: messageId },
            data: { content: `Error starting agent: ${errMsg}` },
          }),
        ])
      } catch {
        // Ignore
      }
      await resetSandboxStatus(sandboxRecord.id, sandboxRecord.branch?.id)
      return internalError(error)
    }

    // refreshActivity is Daytona-specific heartbeat; no-op for local runtimes
    if (!localCtx) {
      try {
        const s = sandbox as unknown as { refreshActivity?: () => Promise<void> }
        await s.refreshActivity?.()
      } catch {
        // Non-critical
      }
    }

    // Log activity for metrics
    logActivity(auth.userId, "agent_executed", {
      sandboxId: daytonaSandboxId,
      repoOwner: sandboxRecord.branch?.repo?.owner,
      repoName: actualRepoName,
      branchName: sandboxRecord.branch?.name,
      agent,
      model,
    })

    return Response.json({ success: true, messageId, executionId: agentExecution.id })
  } catch (error: unknown) {
    // Handle sandbox not found - tell frontend to recreate
    if (error instanceof SandboxNotFoundError) {
      // Clean up the stale sandbox record from DB
      await prisma.sandbox.delete({ where: { id: sandboxRecord.id } }).catch(() => {})

      // Return info needed for frontend to recreate
      // Only branchId is needed - the create endpoint will fetch branch details
      return Response.json(
        {
          error: "SANDBOX_NOT_FOUND",
          message: "Sandbox was deleted and needs to be recreated",
          recreateInfo: {
            branchId: sandboxRecord.branch?.id,
          },
        },
        { status: 410 } // 410 Gone - resource no longer available
      )
    }

    // Other errors - sandbox not ready, session creation failed
    await resetSandboxStatus(sandboxRecord.id, sandboxRecord.branch?.id)
    return internalError(error)
  }
}
