import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowUpRight,
  Apple,
  Download as DownloadIcon,
  Globe,
  Loader2,
} from "lucide-react"

const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  "https://charclaw.upfyn.com"
const REPO_URL = "https://github.com/AnitChaudhry/CharClaw-App"
const LATEST_RELEASE_API =
  "https://api.github.com/repos/AnitChaudhry/CharClaw-App/releases/latest"

type OS = "mac" | "windows" | "linux"

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}
interface ReleaseShape {
  tag_name: string
  html_url: string
  published_at: string
  assets: ReleaseAsset[]
}

interface OsInfo {
  key: OS
  label: string
  icon: React.ReactNode
}

const OS_LIST: OsInfo[] = [
  { key: "mac", label: "macOS", icon: <Apple className="h-4 w-4" /> },
  // No first-party "windows" lucide icon — use a small svg below.
  { key: "windows", label: "Windows", icon: <WindowsGlyph /> },
  { key: "linux", label: "Linux", icon: <LinuxGlyph /> },
]

function WindowsGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 2.4 6.6 1.5v6.1H0V2.4Zm7.4-1L16 0v7.5H7.4V1.4ZM0 8.4h6.6v6.1L0 13.6V8.4Zm7.4 0H16V16l-8.6-1.2V8.4Z" />
    </svg>
  )
}
function LinuxGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 1.6c-1.7 0-3 1.3-3 3 0 .9.4 1.7 1 2.3-.5.6-1.6 1.4-2 2.6-.6 1.6-.7 3.4 0 4 .6.5 1.4-.3 2.6-.3.6 0 1.2.5 1.4 1 .2.5 1.7.5 2 0 .2-.5.8-1 1.4-1 1.2 0 2 .8 2.6.3.7-.6.6-2.4 0-4-.4-1.2-1.5-2-2-2.6.6-.6 1-1.4 1-2.3 0-1.7-1.3-3-3-3Zm-.6 2.3c.2 0 .4.2.4.5s-.2.5-.4.5-.4-.2-.4-.5.2-.5.4-.5Zm1.2 0c.2 0 .4.2.4.5s-.2.5-.4.5-.4-.2-.4-.5.2-.5.4-.5Z" />
    </svg>
  )
}

function detectOS(): OS | null {
  if (typeof navigator === "undefined") return null
  const platform =
    (navigator as Navigator & {
      userAgentData?: { platform?: string }
    }).userAgentData?.platform ||
    navigator.platform ||
    ""
  const ua = navigator.userAgent || ""
  const probe = `${platform} ${ua}`.toLowerCase()
  if (/(mac|iphone|ipad|darwin)/.test(probe)) return "mac"
  if (/win/.test(probe)) return "windows"
  if (/linux|cros|x11/.test(probe)) return "linux"
  return null
}

function categorizeAsset(name: string): OS | null {
  if (/\.dmg$/i.test(name)) return "mac"
  if (/\.(exe|msi)$/i.test(name)) return "windows"
  if (/\.(appimage|deb|rpm)$/i.test(name)) return "linux"
  return null
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function Download() {
  const [release, setRelease] = useState<ReleaseShape | null>(null)
  const [error, setError] = useState<string | null>(null)
  const detectedOS = useMemo(() => detectOS(), [])

  useEffect(() => {
    let cancelled = false
    fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as ReleaseShape
      })
      .then((data) => {
        if (!cancelled) setRelease(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Map OS → first matching asset.
  const assetsByOs = useMemo(() => {
    const map: Partial<Record<OS, ReleaseAsset>> = {}
    for (const a of release?.assets ?? []) {
      const k = categorizeAsset(a.name)
      if (k && !map[k]) map[k] = a
    }
    return map
  }, [release])

  const version = release?.tag_name?.replace(/^v/, "") ?? null
  const primaryOs: OS = detectedOS ?? "mac"
  const primaryAsset = assetsByOs[primaryOs]

  return (
    <section
      id="download"
      className="relative z-10 mx-auto max-w-5xl px-6 pb-24"
    >
      <div className="animate-fade-rise-delay-3 mb-8 text-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Two ways to start
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Desktop card: smart per-OS picker */}
        <div className="liquid-glass relative flex flex-col rounded-2xl p-7">
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span>Desktop</span>
            <ArrowUpRight className="h-4 w-4 opacity-60" />
          </div>
          <h3
            className="mb-3 text-2xl font-normal leading-tight text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            CharClaw for {OS_LIST.find((o) => o.key === primaryOs)?.label ??
              "your machine"}
          </h3>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            Native Electron app with a built-in runtime daemon. System-tray
            shortcut, in-app updater, agents running fully offline where
            they have the most leverage — your machine.
          </p>

          {/* Primary download */}
          {!release && !error && (
            <div className="mb-3 inline-flex items-center gap-2 self-start rounded-md bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground ring-1 ring-white/10">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading latest release…
            </div>
          )}
          {error && (
            <a
              href={`${REPO_URL}/releases/latest`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3"
            >
              <Button variant="glass" size="md" className="self-start">
                <DownloadIcon className="h-4 w-4" />
                Download from GitHub
              </Button>
            </a>
          )}
          {release && (
            <>
              {primaryAsset ? (
                <a
                  href={primaryAsset.browser_download_url}
                  className="mb-3 inline-block self-start"
                >
                  <Button variant="glass" size="md">
                    <DownloadIcon className="h-4 w-4" />
                    Download for{" "}
                    {OS_LIST.find((o) => o.key === primaryOs)?.label}
                    {version && (
                      <span className="ml-2 text-[11px] opacity-60">
                        v{version}
                      </span>
                    )}
                  </Button>
                </a>
              ) : (
                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 inline-block self-start"
                >
                  <Button variant="glass" size="md">
                    <DownloadIcon className="h-4 w-4" />
                    See release v{version}
                  </Button>
                </a>
              )}

              {/* Other OSes */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {OS_LIST.filter((o) => o.key !== primaryOs).map((o) => {
                  const a = assetsByOs[o.key]
                  if (!a) return null
                  return (
                    <a
                      key={o.key}
                      href={a.browser_download_url}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                    >
                      {o.icon}
                      {o.label}
                      <span className="opacity-50">
                        · {formatSize(a.size)}
                      </span>
                    </a>
                  )
                })}
              </div>

              <div className="mt-5 text-[11px] text-muted-foreground/80">
                <a
                  href={`${REPO_URL}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  See all versions ↗
                </a>
                <span className="mx-2 opacity-30">·</span>
                <span>Apache 2.0 — fork & rebrand freely</span>
              </div>
            </>
          )}
        </div>

        {/* Web card unchanged */}
        <a
          href={APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="liquid-glass group relative flex flex-col rounded-2xl p-7 no-underline"
        >
          <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span>Web</span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <h3
            className="mb-3 text-2xl font-normal leading-tight text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Try it in your browser
          </h3>
          <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
            Same board, same agents, no install. Sign in with GitHub and
            hand a repo to a teammate in under a minute. Great for trying
            CharClaw before you commit.
          </p>
          <Button variant="glass" size="md" className="self-start" tabIndex={-1}>
            <Globe className="h-4 w-4" />
            Open web app
          </Button>
        </a>
      </div>

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground"
        >
          View source on GitHub
        </a>
      </div>
    </section>
  )
}
