/**
 * Executes an issue task locally using LocalMachineSandbox + the agents SDK.
 */

import fs from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createLocalSandbox, localWorkdir } from "@charclaw/agents"
import type { DaemonConfig } from "./config.js"

const execFileAsync = promisify(execFile)

export interface TaskPayload {
  issueId: string
  title: string
  body: string
  agent: string           // "claude-code" | "codex" | etc.
  model?: string
  repoOwner: string
  repoName: string
  baseBranch: string
  branchName: string
  githubToken: string
  env?: Record<string, string>
}

type ProgressKind = "cloning" | "running" | "blocked" | "completed" | "failed"

async function postProgress(
  config: DaemonConfig,
  issueId: string,
  kind: ProgressKind,
  message: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${config.serverUrl}/api/runtime/progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.daemonToken}`,
      },
      body: JSON.stringify({ issueId, kind, message, ...extra }),
    })
  } catch (err) {
    console.error("[executor] Failed to post progress:", err)
  }
}

export async function executeTask(
  config: DaemonConfig,
  task: TaskPayload
): Promise<void> {
  const { issueId, repoOwner, repoName, branchName, baseBranch, agent, model, githubToken, env = {} } = task

  await postProgress(config, issueId, "cloning", `Cloning ${repoOwner}/${repoName}…`)

  const cwd = localWorkdir(config.workspaceRoot, repoOwner, repoName, branchName)
  fs.mkdirSync(cwd, { recursive: true })

  // Clone or fetch
  const authedUrl = `https://x-access-token:${githubToken}@github.com/${repoOwner}/${repoName}.git`

  if (!fs.existsSync(`${cwd}/.git`)) {
    await execFileAsync("git", [
      "clone", "--branch", baseBranch, "--single-branch", authedUrl, "."
    ], { cwd })
  } else {
    await execFileAsync("git", ["fetch", authedUrl, baseBranch], { cwd })
    await execFileAsync("git", ["checkout", baseBranch], { cwd })
    await execFileAsync("git", ["pull", authedUrl, baseBranch], { cwd })
  }

  // Create or switch to issue branch
  try {
    await execFileAsync("git", ["checkout", "-b", branchName], { cwd })
  } catch {
    await execFileAsync("git", ["checkout", branchName], { cwd })
  }

  await postProgress(config, issueId, "running", `Agent ${agent} starting…`)

  // Build the sandbox and start the agent
  const sandbox = createLocalSandbox({ cwd, env })

  // Ensure the agent CLI is available
  await sandbox.ensureProvider(agent as Parameters<typeof sandbox.ensureProvider>[0])

  // Build prompt from issue title + body
  const prompt = [task.title, task.body].filter(Boolean).join("\n\n")

  // Stream output back to server
  let outputBuffer = ""
  const flushInterval = setInterval(async () => {
    if (outputBuffer) {
      await postProgress(config, issueId, "running", outputBuffer.slice(-2000))
      outputBuffer = ""
    }
  }, 3000)

  try {
    const { randomUUID } = await import("node:crypto")
    const sessionDir = `/tmp/charclaw-${randomUUID()}`
    fs.mkdirSync(sessionDir, { recursive: true })

    const outputFile = `${sessionDir}/output.jsonl`
    const agentCmd = buildAgentCommand(agent, model, prompt, sessionDir)

    const { pid } = await sandbox.executeBackground!({
      command: agentCmd,
      outputFile,
      runId: issueId,
      timeout: 30,
    })

    // Poll until done
    while (true) {
      await new Promise((r) => setTimeout(r, 2000))
      const state = await sandbox.pollBackgroundState!(sessionDir)
      if (!state) continue

      if (state.output) {
        outputBuffer += state.output
      }

      if (state.done) break
    }

    clearInterval(flushInterval)

    // Final flush
    if (outputBuffer) {
      await postProgress(config, issueId, "running", outputBuffer.slice(-2000))
    }

    // Check if any commits were made
    const { stdout: diffStat } = await execFileAsync(
      "git", ["log", `origin/${baseBranch}..HEAD`, "--oneline"], { cwd }
    ).catch(() => ({ stdout: "" }))

    await postProgress(config, issueId, "completed", "Task completed", {
      commits: diffStat.trim().split("\n").filter(Boolean).length,
      branchName,
    })

    // Push branch
    await execFileAsync("git", ["push", authedUrl, `${branchName}:${branchName}`, "--force-with-lease"], { cwd })
      .catch((err: Error) => console.warn("[executor] push failed:", err.message))

  } catch (err: unknown) {
    clearInterval(flushInterval)
    const message = err instanceof Error ? err.message : String(err)
    console.error("[executor] Task failed:", message)
    await postProgress(config, issueId, "failed", message)
  }
}

function buildAgentCommand(agent: string, model: string | undefined, prompt: string, sessionDir: string): string {
  const safePrompt = prompt.replace(/'/g, "'\\''")
  const safeDir = sessionDir.replace(/'/g, "'\\''")

  switch (agent) {
    case "claude-code":
      return model
        ? `claude --model ${model} --print '${safePrompt}' 2>&1`
        : `claude --print '${safePrompt}' 2>&1`
    case "codex":
      return `codex --full-auto '${safePrompt}' 2>&1`
    case "opencode":
      return `opencode run '${safePrompt}' 2>&1`
    case "gemini":
      return `gemini -p '${safePrompt}' 2>&1`
    case "goose":
      return `goose run --text '${safePrompt}' 2>&1`
    default:
      return `${agent} '${safePrompt}' 2>&1`
  }
}
