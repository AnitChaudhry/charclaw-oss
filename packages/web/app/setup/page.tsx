"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Terminal,
  X,
} from "lucide-react"
import { cn } from "@/lib/shared/utils"

interface SetupStatus {
  runtimes: Array<{
    id: string
    name: string
    kind: string
    status: string
    workspaceRoot: string | null
    capabilities: { agents?: string[]; platform?: string } | null
    lastHeartbeat: string | null
  }>
  runtime: {
    kind: string | null
    status: string | null
    registered: boolean
    online: boolean
    stale: boolean
    staleForMs: number | null
    lastHeartbeat: string | null
  }
  agents: Array<{
    name: string
    binary: string
    detected: boolean
    version: string | null
    installHint: string
  }>
  keys: {
    anthropic: boolean
    openai: boolean
    opencode: boolean
    gemini: boolean
    daytona: boolean
  }
  ready: boolean
}

type Runtime = "local" | "daytona"

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs",
        ok
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
          : "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  )
}

function humanizeDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "never"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

function CopyableCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(cmd).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-black/40 px-3 py-2 pr-10 font-mono text-xs text-foreground/90">
        {cmd}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-1.5 top-1.5 rounded border border-border bg-background/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground opacity-70 transition-all hover:opacity-100 hover:text-foreground"
        aria-label="Copy command"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<Runtime>("local")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/setup/status", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SetupStatus
      setStatus(data)
      if (data.runtime.kind === "daytona") setRuntime("daytona")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !status) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
          Failed to load setup status: {error}
          <button
            onClick={load}
            className="mt-3 block rounded border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  const s = status!

  return (
    <main
      className="min-h-dvh bg-background text-foreground"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div
            className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground"
            style={{ fontFamily: "var(--font-jetbrains)" }}
          >
            <span className="text-emerald-400/80">●</span>
            <span>charclaw / setup</span>
          </div>
          <h1
            className="text-5xl leading-tight"
            style={{
              fontFamily: "var(--font-instrument-serif)",
              letterSpacing: "-0.02em",
            }}
          >
            Get CharClaw running
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Three things need to be in place for agents to work: a runtime to
            execute them, at least one agent CLI on the runtime, and an AI
            provider API key. Pick a runtime below and the rest will tell you
            what's missing.
          </p>
        </div>

        {/* Step 1: Choose runtime */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="text-2xl"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              1 · Runtime
            </h2>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> Recheck
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setRuntime("local")}
              className={cn(
                "rounded-xl border p-5 text-left transition-colors",
                runtime === "local"
                  ? "border-foreground/40 bg-foreground/[0.03]"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="font-medium">Local machine</span>
                {runtime === "local" && (
                  <span className="ml-auto rounded-full bg-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">
                    selected
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Run agents as child processes on this machine via the CharClaw
                daemon. No cloud fees. Needs at least one agent CLI installed
                locally.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setRuntime("daytona")}
              className={cn(
                "rounded-xl border p-5 text-left transition-colors",
                runtime === "daytona"
                  ? "border-foreground/40 bg-foreground/[0.03]"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span className="font-medium">Daytona cloud sandboxes</span>
                {runtime === "daytona" && (
                  <span className="ml-auto rounded-full bg-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">
                    selected
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Spin up disposable cloud sandboxes per branch. CLIs are
                auto-installed inside them; you provide a Daytona API key.
              </p>
            </button>
          </div>
        </section>

        {/* Step 2: Runtime status — local path */}
        {runtime === "local" && (
          <>
            <section className="mb-10">
              <h2
                className="mb-4 text-2xl"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                2 · Daemon
              </h2>
              <div className="rounded-xl border border-border p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <StatusPill
                    ok={s.runtime.online}
                    label={s.runtime.online ? "Daemon online" : "Daemon offline"}
                  />
                  {s.runtime.registered && (
                    <span className="text-xs text-muted-foreground">
                      {s.runtime.stale && s.runtime.lastHeartbeat
                        ? `Last seen ${humanizeDuration(s.runtime.staleForMs)} — likely stopped`
                        : s.runtime.lastHeartbeat
                          ? `Heartbeat ${humanizeDuration(s.runtime.staleForMs)}`
                          : "Registered but not heartbeating"}
                    </span>
                  )}
                </div>
                {!s.runtime.registered ? (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Register your machine as a runtime. Go to{" "}
                      <Link href="/workspace" className="underline hover:text-foreground">
                        Workspace settings
                      </Link>{" "}
                      → Runtimes → Generate setup token, then run on this
                      machine:
                    </p>
                    <CopyableCommand cmd="npx @charclaw/daemon setup --server http://localhost:3000 --token YOUR_TOKEN" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Then keep it running with{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                        npx @charclaw/daemon start
                      </code>
                      .
                    </p>
                  </>
                ) : s.runtime.online ? (
                  <p className="text-sm text-muted-foreground">
                    Daemon is heartbeating. Workspace root:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                      {s.runtimes[0]?.workspaceRoot ?? "—"}
                    </code>
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      A daemon is registered but isn&apos;t heartbeating. Start it
                      with:
                    </p>
                    <CopyableCommand cmd="npx @charclaw/daemon start" />
                  </>
                )}
              </div>
            </section>

            <section className="mb-10">
              <h2
                className="mb-4 text-2xl"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                3 · Agent CLIs on PATH
              </h2>
              <p className="mb-2 text-sm text-muted-foreground">
                The daemon detects these on startup by running{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                  where
                </code>{" "}
                (Windows) or{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                  which
                </code>
                . Install at least one and restart the daemon to pick it up.
              </p>
              {s.runtime.registered && s.runtime.stale && (
                <p className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                  Detection below is hidden because the daemon is offline — restart
                  it to pick up any CLIs you install.
                </p>
              )}
              <div className="space-y-2">
                {s.agents.map((a) => (
                  <details
                    key={a.name}
                    className="rounded-lg border border-border bg-card/40 text-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StatusPill
                          ok={a.detected}
                          label={a.detected ? "detected" : "not detected"}
                        />
                        <span className="font-medium">{a.name}</span>
                        <code
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px]"
                          style={{ fontFamily: "var(--font-jetbrains)" }}
                        >
                          {a.binary}
                        </code>
                        {a.detected && a.version && (
                          <code
                            className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300"
                            style={{ fontFamily: "var(--font-jetbrains)" }}
                          >
                            v{a.version}
                          </code>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {a.detected ? "" : "Install →"}
                      </span>
                    </summary>
                    {!a.detected && (
                      <div className="border-t border-border px-4 py-3">
                        <p className="mb-2 text-xs text-muted-foreground">
                          Install command:
                        </p>
                        <CopyableCommand cmd={a.installHint} />
                      </div>
                    )}
                  </details>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Step 2: Daytona path */}
        {runtime === "daytona" && (
          <section className="mb-10">
            <h2
              className="mb-4 text-2xl"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              2 · Daytona API key
            </h2>
            <div className="rounded-xl border border-border p-5">
              <div className="mb-3 flex items-center gap-3">
                <StatusPill
                  ok={s.keys.daytona}
                  label={s.keys.daytona ? "DAYTONA_API_KEY set" : "DAYTONA_API_KEY missing"}
                />
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Get an API key at{" "}
                <a
                  href="https://app.daytona.io/account/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  app.daytona.io/account/keys
                </a>
                . Add it to your server env (<code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">DAYTONA_API_KEY</code>)
                and restart the web process. This key is server-side only and
                shared across all users of this deployment.
              </p>
            </div>
          </section>
        )}

        {/* API keys (shared) */}
        <section className="mb-10">
          <h2
            className="mb-4 text-2xl"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            {runtime === "local" ? "4" : "3"} · AI provider keys
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Per-user AI keys are stored encrypted and passed to agent CLIs at
            runtime. Set at least one to match the agent you plan to use.
            Manage them from{" "}
            <Link href="/" className="underline hover:text-foreground">
              Settings → Credentials
            </Link>
            .
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span>Anthropic</span>
              <StatusPill ok={s.keys.anthropic} label={s.keys.anthropic ? "set" : "unset"} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span>OpenAI</span>
              <StatusPill ok={s.keys.openai} label={s.keys.openai ? "set" : "unset"} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span>OpenCode</span>
              <StatusPill ok={s.keys.opencode} label={s.keys.opencode ? "set" : "unset"} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span>Gemini</span>
              <StatusPill ok={s.keys.gemini} label={s.keys.gemini ? "set" : "unset"} />
            </div>
          </div>
        </section>

        {/* Ready banner */}
        <div
          className={cn(
            "mt-10 flex items-center justify-between rounded-xl border px-5 py-4",
            s.ready
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-border bg-card/40",
          )}
        >
          <div>
            <div className="text-sm font-medium">
              {s.ready ? "Ready to go" : "More setup needed"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.ready
                ? "All prerequisites are met. You can start using CharClaw."
                : "Keep this page open, install the missing pieces above, and click Recheck."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!s.ready && (
              <button
                onClick={() => router.push("/")}
                className="whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                s.ready
                  ? "bg-foreground text-background hover:scale-[1.03]"
                  : "bg-foreground/90 text-background hover:bg-foreground",
              )}
            >
              {s.ready ? "Open CharClaw" : "Continue anyway"}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
