"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { IssueBoard } from "@/components/issues/IssueBoard"

declare global {
  interface Window {
    __charclaw?: {
      onOpenNewIssue?: (cb: () => void) => void
      isDesktop?: boolean
    }
  }
}

export default function BoardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const openNewIssueRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  // Register tray "New Issue" handler when running in Electron
  useEffect(() => {
    window.__charclaw?.onOpenNewIssue?.(() => {
      openNewIssueRef.current?.()
    })
  }, [])

  if (status === "loading" || !session) return null

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <IssueBoard onRegisterOpenNew={(fn) => { openNewIssueRef.current = fn }} />
    </main>
  )
}
