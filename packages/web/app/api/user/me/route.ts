import { prisma } from "@/lib/db/prisma"
import { getQuota } from "@/lib/sandbox/quota"
import { requireAuth, isAuthError, notFound, internalError } from "@/lib/shared/api-helpers"
import { hasOpenRouterKey } from "@/lib/llm/llm"

// Prevent Next.js from caching this route - always fetch fresh data
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        githubLogin: true,
        isAdmin: true,
        repoOrder: true,
        credentials: {
          select: {
            anthropicAuthType: true,
            // Don't send actual keys to client, just whether they exist
            anthropicApiKey: true,
            anthropicAuthToken: true,
            openaiApiKey: true,
            opencodeApiKey: true,
            geminiApiKey: true,
            daytonaApiKey: true,
            sandboxAutoStopInterval: true,
            squashOnMerge: true,
            prDescriptionMode: true,
          },
        },
        // Include workspace memberships (a user may belong to multiple
        // workspaces now). We pull the ones they don't own so the UI can
        // surface "using so-and-so's Claude subscription" like the old
        // team logic.
        workspaceMemberships: {
          where: { workspace: { NOT: { ownerId: auth.userId } } },
          include: {
            workspace: {
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    githubLogin: true,
                    image: true,
                    // Include owner credentials to check for shared subscriptions
                    credentials: {
                      select: {
                        anthropicAuthToken: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        ownedWorkspace: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, githubLogin: true, image: true },
                },
              },
            },
          },
        },
        repos: {
          include: {
            branches: {
              include: {
                sandbox: true,
                // Don't load messages in initial user fetch - load on-demand when branch selected
                messages: false,
                _count: {
                  select: { messages: true }, // Include total count for UI
                },
              },
              orderBy: { updatedAt: "desc" }, // Most recently active branches first
              take: 10, // Limit branches per repo
            },
            _count: {
              select: { branches: true }, // Total branch count for pagination
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20, // Limit repos returned
        },
      },
    })

    if (!user) {
      return notFound("User not found")
    }

    const quota = await getQuota(auth.userId)

    // Transform credentials to just show existence, not values
    const serverLlmFallback = hasOpenRouterKey()

    // Check if user is a workspace member (in a non-owned workspace) whose
    // owner has a Claude subscription — inheritance preserves the old
    // team-based credential sharing behavior.
    const inheritedClaudeMembership = user.workspaceMemberships?.find(
      (m) => !!m.workspace?.owner?.credentials?.anthropicAuthToken
    )
    const teamOwnerHasClaudeSubscription = !!inheritedClaudeMembership

    const credentials = user.credentials
      ? {
          anthropicAuthType: user.credentials.anthropicAuthType,
          hasAnthropicApiKey: !!user.credentials.anthropicApiKey,
          // User has access to Claude if they have their own token OR their team owner has one
          hasAnthropicAuthToken: !!user.credentials.anthropicAuthToken || teamOwnerHasClaudeSubscription,
          hasOpenaiApiKey: !!user.credentials.openaiApiKey,
          hasOpencodeApiKey: !!user.credentials.opencodeApiKey,
          hasGeminiApiKey: !!user.credentials.geminiApiKey,
          hasDaytonaApiKey: !!user.credentials.daytonaApiKey,
          sandboxAutoStopInterval: user.credentials.sandboxAutoStopInterval,
          squashOnMerge: user.credentials.squashOnMerge,
          prDescriptionMode: user.credentials.prDescriptionMode,
          ...(serverLlmFallback ? { hasServerLlmFallback: true } : {}),
        }
      : teamOwnerHasClaudeSubscription
        ? {
            // Team member without their own credentials but with access to team owner's Claude subscription
            hasAnthropicAuthToken: true,
            ...(serverLlmFallback ? { hasServerLlmFallback: true } : {}),
          }
        : serverLlmFallback
          ? { hasServerLlmFallback: true as const }
          : null

    // Build team/workspace info (kept under the `team` key for API
    // backwards compatibility with the desktop client). If the user owns
    // a workspace we expose it; otherwise we surface the first non-owned
    // workspace membership so legacy "team member" UI keeps working.
    const inheritedMembership = user.workspaceMemberships?.[0]
    const team = user.ownedWorkspace
      ? {
          isOwner: true as const,
          members: user.ownedWorkspace.members
            .filter((m) => m.userId !== user.id) // hide self from members list (matches old Team UX)
            .map((m) => ({
              id: m.user.id,
              name: m.user.name,
              githubLogin: m.user.githubLogin,
              image: m.user.image,
              joinedAt: m.createdAt,
            })),
        }
      : inheritedMembership
        ? {
            isOwner: false as const,
            owner: {
              id: inheritedMembership.workspace.owner.id,
              name: inheritedMembership.workspace.owner.name,
              githubLogin: inheritedMembership.workspace.owner.githubLogin,
              image: inheritedMembership.workspace.owner.image,
            },
          }
        : null

    // Apply saved repo order if it exists
    let orderedRepos = user.repos
    if (user.repoOrder && Array.isArray(user.repoOrder)) {
      const orderMap = new Map((user.repoOrder as string[]).map((id, index) => [id, index]))
      orderedRepos = [...user.repos].sort((a, b) => {
        const posA = orderMap.get(a.id)
        const posB = orderMap.get(b.id)
        // Repos with saved order come first, sorted by position
        // Repos without saved order come last, preserving original order
        if (posA !== undefined && posB !== undefined) return posA - posB
        if (posA !== undefined) return -1
        if (posB !== undefined) return 1
        return 0
      })
    }

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        githubLogin: user.githubLogin,
        isAdmin: user.isAdmin,
      },
      credentials,
      team,
      repos: orderedRepos,
      quota,
    })
  } catch (error) {
    console.error("GET /api/user/me error:", error)
    return internalError(error)
  }
}
