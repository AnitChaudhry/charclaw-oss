// Cleanup utilities — handles both Daytona cloud sandboxes and local machine workdirs.

import { Daytona } from "@daytonaio/sdk"
import fs from "node:fs"
import { prisma } from "@/lib/db/prisma"
import { getDaytonaApiKey } from "@/lib/shared/api-helpers"
import { logActivity } from "@/lib/shared/activity-log"

// Deletes a sandbox from both its runtime and the database.
async function deleteSandbox(sandboxId: string, apiKey: string, runtimeKind?: string): Promise<boolean> {
  if (runtimeKind === "local") {
    // Local sandbox: sandboxId is the workdir path
    try {
      if (fs.existsSync(sandboxId)) {
        fs.rmSync(sandboxId, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn(`[cleanup] Local workdir delete warning for ${sandboxId}:`, error)
    }
  } else {
    // Daytona cloud
    try {
      const daytona = new Daytona({ apiKey })
      const sandbox = await daytona.get(sandboxId)
      await sandbox.delete()
    } catch (error) {
      console.warn(`[cleanup] Cloud delete warning for ${sandboxId}:`, error)
    }
  }

  try {
    await prisma.sandbox.deleteMany({ where: { sandboxId } })
    return true
  } catch (error) {
    console.error(`[cleanup] DB delete error for ${sandboxId}:`, error)
    return false
  }
}

// Deletes the sandbox associated with a branch. Call BEFORE deleting branch from DB.
export async function deleteSandboxForBranch(branchId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
  const sandbox = await prisma.sandbox.findUnique({
    where: { branchId },
    select: {
      sandboxId: true, userId: true, runtimeId: true,
      branch: { select: { name: true, repo: { select: { owner: true, name: true } } } },
    },
  })

  if (!sandbox) {
    return { success: true }
  }

  // Resolve runtime kind
  let runtimeKind: string | undefined
  if (sandbox.runtimeId) {
    const runtime = await prisma.runtime.findUnique({ where: { id: sandbox.runtimeId }, select: { kind: true } })
    runtimeKind = runtime?.kind
  }

  const apiKey = getDaytonaApiKey()
  // For local runtimes the Daytona key is not needed
  if (runtimeKind !== "local" && typeof apiKey !== "string") {
    return { success: false, error: "Daytona API key not configured" }
  }

  const success = await deleteSandbox(sandbox.sandboxId, typeof apiKey === "string" ? apiKey : "", runtimeKind)

  // Log activity for metrics
  if (success) {
    const logUserId = userId || sandbox.userId
    logActivity(logUserId, "sandbox_deleted", {
      sandboxId: sandbox.sandboxId,
      repoOwner: sandbox.branch?.repo?.owner,
      repoName: sandbox.branch?.repo?.name,
      branchName: sandbox.branch?.name,
    })
  }

  return { success }
}

// Deletes all sandboxes for a repo's branches. Call BEFORE deleting repo from DB.
export async function deleteSandboxesForRepo(repoId: string): Promise<{ succeeded: number; failed: number; total: number }> {
  const sandboxes = await prisma.sandbox.findMany({
    where: { branch: { repoId } },
    select: { sandboxId: true },
  })

  if (sandboxes.length === 0) {
    return { succeeded: 0, failed: 0, total: 0 }
  }

  const apiKey = getDaytonaApiKey()
  if (typeof apiKey !== "string") {
    return { succeeded: 0, failed: sandboxes.length, total: sandboxes.length }
  }

  const results = await Promise.all(
    sandboxes.map((s) => deleteSandbox(s.sandboxId, apiKey))
  )

  const succeeded = results.filter(Boolean).length
  return { succeeded, failed: results.length - succeeded, total: results.length }
}

// Cleans up a Daytona sandbox during creation rollback
export async function cleanupDaytonaSandbox(daytona: Daytona, sandboxId: string): Promise<void> {
  try {
    const sandbox = await daytona.get(sandboxId)
    await sandbox.delete()
  } catch (error) {
    console.warn(`[daytona-cleanup] Failed to cleanup sandbox ${sandboxId}:`, error)
  }
}
