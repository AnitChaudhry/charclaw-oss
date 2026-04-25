/**
 * GET /api/setup/status
 *
 * Single survey endpoint powering the /setup onboarding page. Reports
 * everything a user needs to know to get CharClaw working on their
 * machine: runtime availability, detected agent CLIs, and which AI
 * provider API keys are set.
 *
 * No secret values are returned — only boolean presence flags.
 */

import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, resolveUserCredentials } from "@/lib/shared/api-helpers"

const ALL_AGENTS = [
  { name: "claude-code", binary: "claude",   installHint: "npm install -g @anthropic-ai/claude-code" },
  { name: "codex",       binary: "codex",    installHint: "npm install -g @openai/codex-cli" },
  { name: "opencode",    binary: "opencode", installHint: "npm install -g opencode-cli" },
  { name: "gemini",      binary: "gemini",   installHint: "npm install -g @google/gemini-cli" },
  { name: "goose",       binary: "goose",    installHint: "curl -fsSL https://github.com/block/goose/releases/latest/download/download_cli.sh | bash" },
  { name: "pi",          binary: "pi",       installHint: "npm install -g inflection-pi-cli" },
]

export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth
  const { userId } = auth

  // Runtime overview — is there a local daemon registered? Is it online?
  const rawRuntimes = await prisma.runtime.findMany({
    where: { userId },
    orderBy: [{ lastHeartbeat: "desc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      workspaceRoot: true,
      capabilities: true,
      lastHeartbeat: true,
    },
  })

  // Consider capabilities "stale" if the daemon hasn't heartbeated in
  // >5 minutes. Stale runtimes shouldn't mask "agent not detected" with
  // an ancient success signal — so we only count their agents when fresh.
  const STALE_THRESHOLD_MS = 5 * 60 * 1000
  const now = Date.now()
  const runtimes = rawRuntimes.map((r) => {
    const hb = r.lastHeartbeat?.getTime() ?? 0
    const staleFor = hb > 0 ? now - hb : null
    const stale = staleFor === null || staleFor > STALE_THRESHOLD_MS
    return { ...r, stale, staleForMs: staleFor }
  })

  const online = runtimes.find((r) => r.status === "online" && !r.stale) ?? null

  const detectedAgents = new Set<string>()
  // Most-recent non-stale version wins. `runtimes` is already sorted by
  // lastHeartbeat desc, so the first encounter is the freshest.
  const detectedVersions = new Map<string, string | null>()
  for (const r of runtimes) {
    if (r.stale) continue // don't trust stale capability caches
    const caps = (r.capabilities as {
      agents?: string[]
      agentVersions?: Record<string, string | null>
    } | null) ?? null
    for (const a of caps?.agents ?? []) {
      detectedAgents.add(a)
      if (!detectedVersions.has(a)) {
        detectedVersions.set(a, caps?.agentVersions?.[a] ?? null)
      }
    }
  }

  const agents = ALL_AGENTS.map((a) => ({
    name: a.name,
    binary: a.binary,
    detected: detectedAgents.has(a.name),
    version: detectedVersions.get(a.name) ?? null,
    installHint: a.installHint,
  }))

  // API key status (presence flags only — never leak values)
  const credentials = await prisma.userCredentials.findUnique({ where: { userId } })
  const { anthropicApiKey, anthropicAuthToken } = await resolveUserCredentials(credentials, userId)

  const keys = {
    anthropic: !!(anthropicApiKey || anthropicAuthToken),
    openai: !!credentials?.openaiApiKey,
    opencode: !!credentials?.opencodeApiKey,
    gemini: !!credentials?.geminiApiKey,
    daytona: !!process.env.DAYTONA_API_KEY,
  }

  const hasRuntime = runtimes.length > 0
  const hasOnlineRuntime = !!online
  const hasAnyAgent = agents.some((a) => a.detected)
  const hasAnyKey = keys.anthropic || keys.openai || keys.opencode || keys.gemini
  const topRuntime = online ?? runtimes[0] ?? null

  return Response.json({
    runtimes,
    runtime: {
      kind: topRuntime?.kind ?? null,
      status: topRuntime?.status ?? null,
      registered: hasRuntime,
      online: hasOnlineRuntime,
      stale: topRuntime?.stale ?? true,
      staleForMs: topRuntime?.staleForMs ?? null,
      lastHeartbeat: topRuntime?.lastHeartbeat ?? null,
    },
    agents,
    keys,
    ready: hasOnlineRuntime && hasAnyAgent && hasAnyKey,
  })
}
