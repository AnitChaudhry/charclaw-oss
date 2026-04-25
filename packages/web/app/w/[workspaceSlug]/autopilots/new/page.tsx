"use client"

import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AutopilotForm } from "@/components/autopilots/AutopilotForm"
import { useCreateAutopilot } from "@/hooks/useAutopilots"

interface PageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default function NewAutopilotPage({ params }: PageProps) {
  const { workspaceSlug } = use(params)
  const router = useRouter()
  const create = useCreateAutopilot()

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <Link
          href={`/w/${workspaceSlug}/autopilots`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to autopilots
        </Link>
      </div>
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          New autopilot
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure a schedule + an issue template. When the autopilot fires,
          a new issue will be created in this workspace.
        </p>
      </header>

      <AutopilotForm
        submitLabel="Create autopilot"
        onSubmit={async (input) => {
          const created = await create.mutateAsync({
            ...input,
            workspaceSlug,
          })
          router.push(`/w/${workspaceSlug}/autopilots/${created.id}`)
        }}
        onCancel={() => router.push(`/w/${workspaceSlug}/autopilots`)}
      />
    </div>
  )
}
