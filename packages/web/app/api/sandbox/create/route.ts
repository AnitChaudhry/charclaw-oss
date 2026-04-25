import { Daytona } from "@daytonaio/sdk"
import { createLocalSandbox, localWorkdir } from "@charclaw/agents"
import { prisma } from "@/lib/db/prisma"
import { checkDuplicateBranchName } from "@/lib/db/branch-helpers"
import { checkQuota } from "@/lib/sandbox/quota"
import { generateSandboxName } from "@/lib/sandbox/sandbox-utils"
import {
  requireAuth,
  isAuthError,
  getDaytonaApiKey,
  isDaytonaKeyError,
  badRequest,
  unauthorized,
  resolveUserCredentials,
  getGitHubTokenForUser,
} from "@/lib/shared/api-helpers"
import { getActiveWorkspace } from "@/lib/auth/workspace"
import { createSSEStream, sendProgress, sendError, sendDone } from "@charclaw/common"
import { SANDBOX_CONFIG, PATHS } from "@/lib/shared/constants"
import { getDefaultAgent, type Agent } from "@/lib/shared/types"
import { cleanupDaytonaSandbox } from "@/lib/sandbox/daytona-cleanup"
import { decrypt } from "@/lib/auth/encryption"
import { logActivity } from "@/lib/shared/activity-log"

// Sandbox creation timeout - 300 seconds (must be literal for Next.js static analysis)
export const maxDuration = 300

export async function POST(req: Request) {
  // 1. Authenticate
  const authResult = await requireAuth()
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  const body = await req.json()
  const { repoId, repoOwner, repoName, baseBranch, newBranch, startCommit, existingBranchId } = body
  const requestedAgent: string | undefined = typeof body.agent === "string" ? body.agent : undefined
  const requestedModel: string | undefined = typeof body.model === "string" ? body.model : undefined

  // For recreation, we need existingBranchId; for new branches, we need the standard fields
  if (existingBranchId) {
    // Recreation mode - we'll fetch branch info from DB
  } else if (!repoOwner || !repoName || !newBranch) {
    return badRequest("Missing required fields")
  }

  // 2. Check quota
  const quota = await checkQuota(userId)
  if (!quota.allowed) {
    return Response.json(
      {
        error: "Quota exceeded",
        message: `You have ${quota.current}/${quota.max} sandboxes. Please stop one before creating another.`,
      },
      { status: 429 }
    )
  }

  // 3. Get credentials
  // NOTE: Daytona API key is only required when we actually need to talk to
  // Daytona. Users on the local runtime path never need it, so we defer the
  // check until after runtime resolution below.
  let daytonaApiKey: string | null = null

  // Get GitHub token from NextAuth
  const githubToken = await getGitHubTokenForUser(userId)
  if (!githubToken) {
    return unauthorized()
  }

  // Get user's Anthropic credentials
  const userCredentials = await prisma.userCredentials.findUnique({
    where: { userId },
  })

  const { anthropicApiKey, anthropicAuthToken, anthropicAuthType } =
    await resolveUserCredentials(userCredentials, userId)
  const sandboxAutoStopInterval = userCredentials?.sandboxAutoStopInterval ?? 5

  // Check if user has Anthropic credentials - used to determine default agent
  const hasAnthropicCredential =
    (anthropicAuthType === "claude-max" && anthropicAuthToken) ||
    (anthropicAuthType !== "claude-max" && anthropicApiKey)

  // Determine default agent based on available credentials
  // Users without Anthropic credentials default to opencode with free models
  const defaultAgent = getDefaultAgent({
    hasAnthropicApiKey: !!anthropicApiKey,
    hasAnthropicAuthToken: !!anthropicAuthToken,
  })

  // For recreation mode, fetch the existing branch and its repo
  let existingBranch: {
    id: string
    name: string
    baseBranch: string | null
    agent: string
    repo: { id: string; owner: string; name: string }
  } | null = null

  if (existingBranchId) {
    existingBranch = await prisma.branch.findFirst({
      where: { id: existingBranchId, repo: { userId } },
      select: {
        id: true,
        name: true,
        baseBranch: true,
        agent: true,
        repo: { select: { id: true, owner: true, name: true } },
      },
    })
    if (!existingBranch) {
      return badRequest("Branch not found or doesn't belong to user")
    }
  }

  // Use existing branch info for recreation, or request params for new branch
  const effectiveRepoOwner = existingBranch?.repo.owner ?? repoOwner
  const effectiveRepoName = existingBranch?.repo.name ?? repoName
  const effectiveBranchName = existingBranch?.name ?? newBranch
  const effectiveBaseBranch = existingBranch?.baseBranch ?? baseBranch ?? "main"
  const effectiveRepoId = existingBranch?.repo.id ?? repoId
  const isRecreation = !!existingBranch

  // Resolve active runtime for this user (prefer local, fall back to Daytona)
  const activeRuntime = await prisma.runtime.findFirst({
    where: { userId, status: "online" },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }], // "daytona" < "local" alphabetically; explicit ordering below
  }).then(async (r) => {
    if (r) return r
    // No online runtime — check for any local runtime regardless of status
    return prisma.runtime.findFirst({ where: { userId, kind: "local" } })
  })
  const useLocal = activeRuntime?.kind === "local" && !!activeRuntime.workspaceRoot

  // Only require Daytona API key when we're actually going to use Daytona.
  if (!useLocal) {
    const key = getDaytonaApiKey()
    if (isDaytonaKeyError(key)) return key
    daytonaApiKey = key
  }

  // Track records for cleanup on error
  let sandboxRecord: { id: string; sandboxId: string } | null = null
  let branchRecord: { id: string } | null = null
  let daytonaClient: Daytona | null = null
  let daytonaSandboxId: string | null = null

  return createSSEStream({
    onStart: async (controller) => {
      try {
        sendProgress(controller, isRecreation ? "Recreating workspace..." : "Creating workspace...")

        let resolvedSandboxId: string
        let previewUrlPattern: string | undefined
        let executeCommand: (cmd: string, timeout?: number) => Promise<{ exitCode: number; output: string }>

        if (useLocal && activeRuntime) {
          // ── Local runtime path ───────────────────────────────────────────
          const workspaceRoot = activeRuntime.workspaceRoot!
          const cwd = localWorkdir(workspaceRoot, effectiveRepoOwner, effectiveRepoName, effectiveBranchName)
          const localSandbox = createLocalSandbox({ cwd })
          executeCommand = async (cmd, timeout) => {
            const result = await localSandbox.executeCommand!(cmd, timeout)
            return result
          }

          // Create the working directory
          const { execFile } = await import("node:child_process")
          const { promisify } = await import("node:util")
          const execFileAsync = promisify(execFile)
          await execFileAsync("mkdir", ["-p", cwd])

          resolvedSandboxId = cwd // local sandbox ID is the cwd path
          previewUrlPattern = `http://localhost:{port}`

          sendProgress(controller, "Cloning repository...")
          const authedCloneUrl = `https://x-access-token:${githubToken}@github.com/${effectiveRepoOwner}/${effectiveRepoName}.git`

          const cloneResult = await executeCommand(
            `git clone --branch ${effectiveBaseBranch} --single-branch ${authedCloneUrl} . 2>&1 || git -C . fetch ${authedCloneUrl} ${effectiveBaseBranch}:${effectiveBaseBranch} 2>&1`,
            120
          )
          if (cloneResult.exitCode !== 0 && !cloneResult.output.includes("already exists")) {
            throw new Error(`Clone failed: ${cloneResult.output.slice(0, 500)}`)
          }

          // Git author config
          let gitName = "CharClaw Agent"
          let gitEmail = "noreply@charclaw.ai"
          try {
            const ghRes = await fetch("https://api.github.com/user", {
              headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" },
            })
            if (ghRes.ok) {
              const ghUser = await ghRes.json()
              gitName = ghUser.name || ghUser.login
              gitEmail = `${ghUser.login}@users.noreply.github.com`
            }
          } catch {}

          await executeCommand(`git config user.email "${gitEmail}" && git config user.name "${gitName}"`)
          await executeCommand(`mkdir -p /tmp/logs && touch /tmp/.clone_complete`)

          if (isRecreation) {
            sendProgress(controller, `Checking out branch ${effectiveBranchName}...`)
            const fetchBranch = await executeCommand(
              `git fetch ${authedCloneUrl} ${effectiveBranchName}:${effectiveBranchName} 2>&1 || true`
            )
            const branchExists = await executeCommand(
              `git show-ref --verify --quiet refs/heads/${effectiveBranchName} && echo "exists" || echo "not_exists"`
            )
            if (branchExists.output.trim() === "exists") {
              await executeCommand(`git checkout ${effectiveBranchName}`)
            } else {
              await executeCommand(`git checkout -b ${effectiveBranchName}`)
            }
          } else {
            sendProgress(controller, `Creating branch ${effectiveBranchName} from ${effectiveBaseBranch}...`)
            await executeCommand(`git checkout -b ${effectiveBranchName}`)
          }

          if (startCommit && !isRecreation) {
            sendProgress(controller, `Resetting to commit ${startCommit.slice(0, 7)}...`)
            await executeCommand(`git fetch ${authedCloneUrl} '+refs/heads/*:refs/remotes/origin/*' 2>&1`)
            const resetResult = await executeCommand(`git reset --hard ${startCommit} 2>&1`)
            if (resetResult.exitCode) {
              throw new Error(`Failed to reset to commit ${startCommit.slice(0, 7)}: ${resetResult.output}`)
            }
          }

        } else {
          // ── Daytona path ─────────────────────────────────────────────────
          if (!daytonaApiKey) throw new Error("Daytona API key not configured")
          const sandboxName = generateSandboxName(userId)

          let repoEnvVars: Record<string, string> = {}
          const repoForEnv = effectiveRepoId
            ? await prisma.repo.findFirst({ where: { id: effectiveRepoId, userId }, select: { envVars: true } })
            : await prisma.repo.findUnique({
                where: { userId_owner_name: { userId, owner: effectiveRepoOwner, name: effectiveRepoName } },
                select: { envVars: true },
              })
          if (repoForEnv?.envVars) {
            const enc = repoForEnv.envVars as Record<string, string>
            for (const [k, v] of Object.entries(enc)) {
              try { repoEnvVars[k] = decrypt(v) } catch { /* skip */ }
            }
          }

          const sandboxEnvVars: Record<string, string> = { ...repoEnvVars }
          if (anthropicAuthType !== "claude-max" && anthropicApiKey) {
            sandboxEnvVars.ANTHROPIC_API_KEY = anthropicApiKey
          }

          daytonaClient = new Daytona({ apiKey: daytonaApiKey })
          const sandbox = await daytonaClient.create({
            name: sandboxName,
            snapshot: SANDBOX_CONFIG.DEFAULT_SNAPSHOT,
            autoStopInterval: sandboxAutoStopInterval,
            public: true,
            labels: {
              [SANDBOX_CONFIG.LABEL_KEY]: "true",
              repo: `${effectiveRepoOwner}/${effectiveRepoName}`,
              branch: effectiveBranchName,
              userId,
            },
            ...(Object.keys(sandboxEnvVars).length > 0 && { envVars: sandboxEnvVars }),
          })
          daytonaSandboxId = sandbox.id
          resolvedSandboxId = sandbox.id

          executeCommand = async (cmd, timeout) => {
            const r = await sandbox.process.executeCommand(cmd, undefined, undefined, timeout)
            return { exitCode: r.exitCode ?? 0, output: r.result ?? "" }
          }

          await executeCommand(`mkdir -p ${PATHS.LOGS_DIR}`)

          sendProgress(controller, "Cloning repository...")
          const repoPath = `${PATHS.SANDBOX_HOME}/${effectiveRepoName}`
          const cloneUrl = `https://github.com/${effectiveRepoOwner}/${effectiveRepoName}.git`
          await sandbox.git.clone(cloneUrl, repoPath, effectiveBaseBranch, undefined, "x-access-token", githubToken)

          let gitName = "Sandboxed Agent"
          let gitEmail = "noreply@example.com"
          try {
            const ghRes = await fetch("https://api.github.com/user", {
              headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" },
            })
            if (ghRes.ok) {
              const ghUser = await ghRes.json()
              gitName = ghUser.name || ghUser.login
              gitEmail = `${ghUser.login}@users.noreply.github.com`
            }
          } catch {}

          await executeCommand(`cd ${repoPath} && git config user.email "${gitEmail}" && git config user.name "${gitName}"`)
          await executeCommand(`touch ${PATHS.CLONE_MARKER_FILE}`)

          const authedUrl = cloneUrl.replace(/^https:\/\//, `https://x-access-token:${githubToken}@`)

          if (isRecreation) {
            sendProgress(controller, `Checking out branch ${effectiveBranchName}...`)
            await executeCommand(`cd ${repoPath} && git fetch ${authedUrl} ${effectiveBranchName}:${effectiveBranchName} 2>&1 || true`)
            const branchExistsResult = await executeCommand(
              `cd ${repoPath} && git show-ref --verify --quiet refs/heads/${effectiveBranchName} && echo "exists" || echo "not_exists"`
            )
            if (branchExistsResult.output.trim() === "exists") {
              await sandbox.git.checkoutBranch(repoPath, effectiveBranchName)
            } else {
              await sandbox.git.createBranch(repoPath, effectiveBranchName)
              await sandbox.git.checkoutBranch(repoPath, effectiveBranchName)
            }
          } else {
            sendProgress(controller, `Creating branch ${effectiveBranchName} from ${effectiveBaseBranch}...`)
            await sandbox.git.createBranch(repoPath, effectiveBranchName)
            await sandbox.git.checkoutBranch(repoPath, effectiveBranchName)
          }

          if (startCommit && !isRecreation) {
            sendProgress(controller, `Resetting to commit ${startCommit.slice(0, 7)}...`)
            await executeCommand(`cd ${repoPath} && git fetch ${authedUrl} '+refs/heads/*:refs/remotes/origin/*' 2>&1`)
            const resetResult = await executeCommand(`cd ${repoPath} && git reset --hard ${startCommit} 2>&1`)
            if (resetResult.exitCode) {
              throw new Error(`Failed to reset to commit ${startCommit.slice(0, 7)}: ${resetResult.output}`)
            }
          }

          // Preview URL pattern
          try {
            const previewLink = await sandbox.getPreviewLink(SANDBOX_CONFIG.DEFAULT_PREVIEW_PORT)
            previewUrlPattern = previewLink.url.replace(String(SANDBOX_CONFIG.DEFAULT_PREVIEW_PORT), "{port}")
          } catch { /* non-critical */ }
        }

        // ── Shared: capture HEAD commit ───────────────────────────────────
        sendProgress(controller, "Preparing agent environment...")
        const repoPath = useLocal
          ? localWorkdir(activeRuntime!.workspaceRoot!, effectiveRepoOwner, effectiveRepoName, effectiveBranchName)
          : `${PATHS.SANDBOX_HOME}/${effectiveRepoName}`

        const headResult = await executeCommand!(
          `cd "${repoPath}" && git log -1 --format='%h' 2>&1`
        )
        const headCommit = headResult.exitCode ? null : headResult.output.trim()

        // ── Shared: DB records ────────────────────────────────────────────
        let finalBranchId: string
        let finalRepoId: string
        let finalAgent: string

        if (isRecreation && existingBranch) {
          finalBranchId = existingBranch.id
          finalRepoId = existingBranch.repo.id
          finalAgent = existingBranch.agent

          sandboxRecord = await prisma.sandbox.create({
            data: {
              sandboxId: resolvedSandboxId!,
              sandboxName: useLocal ? `local:${effectiveBranchName}` : generateSandboxName(userId),
              userId,
              branchId: finalBranchId,
              previewUrlPattern,
              status: "running",
              ...(activeRuntime && { runtimeId: activeRuntime.id }),
            },
          })

          logActivity(userId, "sandbox_created", {
            repoOwner: effectiveRepoOwner, repoName: effectiveRepoName,
            branchName: effectiveBranchName, sandboxId: resolvedSandboxId,
            agent: finalAgent, isRecreation: true, runtime: useLocal ? "local" : "daytona",
          })
        } else {
          let dbRepo = await prisma.repo.findUnique({
            where: { userId_owner_name: { userId, owner: effectiveRepoOwner, name: effectiveRepoName } },
          })
          if (!dbRepo && effectiveRepoId) {
            dbRepo = await prisma.repo.findUnique({ where: { id: effectiveRepoId } })
          }
          if (!dbRepo) {
            const activeWs = await getActiveWorkspace(userId)
            if (!activeWs) {
              throw new Error("No workspace found for user — cannot create repo")
            }
            dbRepo = await prisma.repo.create({
              data: {
                userId,
                workspaceId: activeWs.id,
                owner: effectiveRepoOwner,
                name: effectiveRepoName,
                defaultBranch: effectiveBaseBranch,
              },
            })
          }

          const duplicateCheck = await checkDuplicateBranchName(dbRepo.id, effectiveBranchName)
          if (duplicateCheck) throw new Error(duplicateCheck.error)

          // Respect the UI's selection — fall back to the credentials-derived
          // default only when the caller didn't supply one.
          const branchAgent =
            (requestedAgent as Agent | undefined) ?? defaultAgent
          const branchModel = requestedModel ?? undefined

          branchRecord = await prisma.branch.create({
            data: {
              repoId: dbRepo.id,
              name: effectiveBranchName,
              baseBranch: effectiveBaseBranch,
              startCommit: headCommit,
              status: "idle",
              agent: branchAgent,
              ...(branchModel ? { model: branchModel } : {}),
            },
          })

          finalBranchId = branchRecord.id
          finalRepoId = dbRepo.id
          finalAgent = branchAgent

          sandboxRecord = await prisma.sandbox.create({
            data: {
              sandboxId: resolvedSandboxId!,
              sandboxName: useLocal ? `local:${effectiveBranchName}` : generateSandboxName(userId),
              userId,
              branchId: finalBranchId,
              previewUrlPattern,
              status: "running",
              ...(activeRuntime && { runtimeId: activeRuntime.id }),
            },
          })

          logActivity(userId, "sandbox_created", {
            repoOwner: effectiveRepoOwner, repoName: effectiveRepoName,
            branchName: effectiveBranchName, sandboxId: resolvedSandboxId,
            agent: finalAgent, runtime: useLocal ? "local" : "daytona",
          })
        }

        sendDone(controller, {
          sandboxId: resolvedSandboxId!,
          previewUrlPattern,
          branchId: finalBranchId,
          repoId: finalRepoId,
          startCommit: headCommit,
          agent: finalAgent,
          isRecreation,
          runtime: useLocal ? "local" : "daytona",
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error(`[sandbox/create] Error: ${message}`)
        sendError(controller, message)

        if (sandboxRecord) {
          await prisma.sandbox.delete({ where: { id: sandboxRecord.id } }).catch((err: unknown) => {
            console.warn(`[sandbox/create] Failed to cleanup sandbox record: ${err}`)
          })
        }
        if (branchRecord) {
          await prisma.branch.delete({ where: { id: branchRecord.id } }).catch((err: unknown) => {
            console.warn(`[sandbox/create] Failed to cleanup branch record: ${err}`)
          })
        }
        if (daytonaSandboxId && daytonaClient) {
          await cleanupDaytonaSandbox(daytonaClient, daytonaSandboxId)
        }
      }
    },
  })
}
