"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function LoginContents() {
  const searchParams = useSearchParams()
  const forceConsent = searchParams.get("consent") === "1"
  const error = searchParams.get("error")
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = () => {
    setSigningIn(true)
    signIn(
      "github",
      { callbackUrl: "/" },
      forceConsent ? { prompt: "consent" } : undefined,
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[hsl(201_100%_13%)] text-foreground">
      {/* Cinematic background: gradient wash + subtle scanline grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(1200px 600px at 20% 0%, rgba(94,180,255,0.18), transparent 60%)," +
            "radial-gradient(900px 500px at 100% 100%, rgba(255,220,180,0.08), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "100% 4px",
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <span
            className="text-2xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            CharClaw<sup className="text-[0.5em]">®</sup>
          </span>
          <a
            href="https://github.com/AnitChaudhry/CharClaw-App"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
            style={{ fontFamily: "var(--font-jetbrains)" }}
          >
            github.com/AnitChaudhry/CharClaw-App
          </a>
        </header>

        {/* Center panel */}
        <div className="flex flex-1 items-center justify-center px-6 pb-20">
          <div className="w-full max-w-md">
            {/* Terminal-style label */}
            <div
              className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground/70"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              <span className="text-emerald-400/80">●</span>
              <span>charclaw/auth</span>
              <span className="flex-1 border-t border-border/40" />
              <span>v0.1</span>
            </div>

            {/* Glassmorphic card */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur">
              {/* Glass edge highlight */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  padding: "1.4px",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.05) 80%, rgba(255,255,255,0.35) 100%)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />

              {/* Prompt line */}
              <div
                className="mb-4 text-xs text-emerald-400/90"
                style={{ fontFamily: "var(--font-jetbrains)" }}
              >
                <span className="opacity-50">$</span>{" "}
                <span>charclaw login --provider github</span>
              </div>

              <h1
                className="mb-2 text-5xl leading-none"
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                Welcome
              </h1>
              <p
                className="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                Sign in with your GitHub account. CharClaw asks for{" "}
                <code
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[0.8em] text-foreground"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  repo
                </code>{" "}
                and{" "}
                <code
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[0.8em] text-foreground"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  read:user
                </code>{" "}
                scope so agents can clone, branch, and push on your behalf.
              </p>

              <button
                onClick={handleSignIn}
                disabled={signingIn}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-medium text-foreground transition-all hover:scale-[1.02] hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-60 disabled:hover:scale-100"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="opacity-90"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span>{signingIn ? "Redirecting to GitHub…" : "Sign in with GitHub"}</span>
              </button>

              {forceConsent && (
                <p
                  className="mt-4 text-center text-[11px] text-muted-foreground"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  prompt=consent — will ask you to re-authorize
                </p>
              )}

              {error && (
                <p
                  className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  auth error: {error}
                </p>
              )}
            </div>

            {/* Bottom meta row */}
            <div
              className="mt-6 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground/60"
              style={{ fontFamily: "var(--font-jetbrains)" }}
            >
              <span className="flex items-center gap-2">
                <span className="text-emerald-400/70">★</span>
                <span>Proudly open source · Apache&nbsp;2.0</span>
              </span>
              <span className="opacity-60">
                <pre
                  className="m-0 inline font-mono leading-none"
                  style={{ fontFamily: "var(--font-jetbrains)" }}
                >
                  {"<°))><"}
                </pre>
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginClient() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[hsl(201_100%_13%)]" />
      }
    >
      <LoginContents />
    </Suspense>
  )
}
