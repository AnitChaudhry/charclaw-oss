"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Search, BookOpen, Tag, TrendingUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/shared/utils"

interface SkillStep {
  action: string
  command?: string
  notes?: string
}

interface Skill {
  id: string
  title: string
  description: string | null
  steps: SkillStep[]
  tags: string[]
  useCount: number
  createdAt: string
}

export default function SkillsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  const fetchSkills = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      let data: { skills: Skill[] }
      if (q && q.trim()) {
        const res = await fetch("/api/skills/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: q.trim() }),
        })
        data = await res.json()
      } else {
        const res = await fetch("/api/skills")
        data = await res.json()
      }
      setSkills(data.skills ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") fetchSkills()
  }, [status, fetchSkills])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchSkills(query), 300)
    return () => clearTimeout(t)
  }, [query, fetchSkills])

  if (status === "loading" || !session) return null

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Skills Library</span>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {skills.length}
          </span>
        </div>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</a>
      </div>

      {/* Search bar */}
      <div className="border-b border-border px-4 py-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills by title, tag, or description…"
            className="w-full rounded-md border border-border bg-secondary/50 pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center px-6">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No skills yet</p>
              <p className="text-xs text-muted-foreground/70">
                Skills are extracted automatically after agents complete sessions.
              </p>
            </div>
          ) : (
            skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => setSelectedSkill(skill)}
                className={cn(
                  "flex flex-col gap-1.5 px-4 py-3 text-left border-b border-border transition-colors hover:bg-accent/50 cursor-pointer",
                  selectedSkill?.id === skill.id && "bg-accent/70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-foreground leading-snug line-clamp-2">{skill.title}</span>
                  {skill.useCount > 0 && (
                    <span className="flex items-center gap-0.5 shrink-0 text-[10px] text-muted-foreground">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {skill.useCount}
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{skill.description}</p>
                )}
                {skill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {skill.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        {selectedSkill ? (
          <div className="flex flex-1 flex-col overflow-y-auto p-5 gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">{selectedSkill.title}</h2>
              {selectedSkill.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedSkill.description}</p>
              )}
            </div>

            {selectedSkill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedSkill.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Steps</span>
              <ol className="flex flex-col gap-3">
                {selectedSkill.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-foreground">{step.action}</span>
                      {step.command && (
                        <code className="rounded-md border border-border bg-secondary px-2 py-1 text-[10px] font-mono text-foreground">
                          {step.command}
                        </code>
                      )}
                      {step.notes && (
                        <span className="text-[11px] text-muted-foreground">{step.notes}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">Select a skill to view details</p>
          </div>
        )}
      </div>
    </main>
  )
}
