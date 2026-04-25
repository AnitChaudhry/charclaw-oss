import Home from "@/app/page"

/**
 * Workspace-scoped home page. For Phase 1 this is a thin wrapper around
 * the existing home view — the layout validates membership and mounts
 * the workspace context; the component tree itself is unchanged. A
 * later phase will teach Home to branch on `useWorkspace()`.
 */
export default function WorkspaceHomePage() {
  return <Home />
}
