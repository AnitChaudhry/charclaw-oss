import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth"
import {
  isAuthSkipped,
  ensureDevUserExists,
  DEV_USER_ID,
} from "@/lib/auth/dev-auth"
import { prisma } from "@/lib/db/prisma"
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider"
import { WorkspaceChrome } from "@/components/layout/WorkspaceChrome"
import type { ReactNode } from "react"

interface Params {
  workspaceSlug: string
}

/**
 * Layout for /w/[workspaceSlug]/** — validates that the current user is
 * a member of the target workspace, loads their role, and exposes the
 * WorkspaceContext to all descendant pages.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<Params>
}) {
  const { workspaceSlug } = await params

  // Resolve the active user (real session or dev bypass).
  let userId: string | null = null
  if (isAuthSkipped()) {
    await ensureDevUserExists()
    userId = DEV_USER_ID
  } else {
    const session = await getServerSession(authOptions)
    userId = session?.user?.id ?? null
  }

  if (!userId) redirect("/login")

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true, name: true },
  })
  if (!workspace) notFound()

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId },
    },
    select: { role: true },
  })
  if (!membership) notFound()

  return (
    <WorkspaceProvider
      workspace={{
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        role: membership.role,
      }}
    >
      <WorkspaceChrome workspaceSlug={workspace.slug} workspaceName={workspace.name}>
        {children}
      </WorkspaceChrome>
    </WorkspaceProvider>
  )
}
