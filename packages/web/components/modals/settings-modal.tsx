"use client"

import { cn } from "@/lib/shared/utils"
import { X, Terminal, Copy, Check, Loader2, Clock, Bot, Box, Key, ExternalLink, AlertTriangle, Trash2, Sun, Moon, Monitor, GitBranch, Server, Plus, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input"
import { PR_DESCRIPTION_LABELS, prDescriptionTypes, type PRDescriptionType } from "@/lib/shared/schemas"

type SettingsTab = "agents" | "sandboxes" | "git" | "appearance" | "runtimes"

// =============================================================================
// Runtime types
// =============================================================================
interface RuntimeRecord {
  id: string
  name: string
  kind: string
  status: string
  workspaceRoot: string | null
  capabilities: { agents?: string[]; freeDiskGb?: number; platform?: string } | null
  lastHeartbeat: string | null
  createdAt: string
}

interface AgentProfileRecord {
  id: string
  name: string
  slug: string
  kind: string
  model: string | null
  avatarUrl: string | null
  runtimeId: string | null
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  credentials?: {
    anthropicAuthType: string
    hasAnthropicApiKey: boolean
    hasAnthropicAuthToken: boolean
    hasOpenaiApiKey: boolean
    hasOpencodeApiKey: boolean
    hasGeminiApiKey: boolean
    hasDaytonaApiKey: boolean
    sandboxAutoStopInterval?: number
    squashOnMerge?: boolean
    prDescriptionMode?: string
  } | null
  onCredentialsUpdate: () => void | Promise<void>
  /** Field to highlight with error styling (e.g., "anthropicApiKey", "openaiApiKey") */
  highlightField?: string | null
  /** Callback to clear the highlight when user starts typing */
  onClearHighlight?: () => void
}

// Track which keys should be cleared on save
type ClearableKey = "anthropicApiKey" | "anthropicAuthToken" | "openaiApiKey" | "opencodeApiKey" | "geminiApiKey" | "daytonaApiKey"

export function SettingsModal({ open, onClose, credentials, onCredentialsUpdate, highlightField, onClearHighlight }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("agents")
  const { theme, setTheme } = useTheme()

  // Theme state - track initial and pending values
  const [initialTheme, setInitialTheme] = useState<string | undefined>(theme)
  const [pendingTheme, setPendingTheme] = useState<string | undefined>(theme)

  // Preview theme by manipulating DOM directly (doesn't persist to localStorage)
  const previewTheme = (value: string) => {
    document.documentElement.classList.add("transitioning")
    // Remove existing theme classes and add new one
    document.documentElement.classList.remove("light", "dark")
    if (value === "dark") {
      document.documentElement.classList.add("dark")
      document.documentElement.style.colorScheme = "dark"
    } else if (value === "light") {
      document.documentElement.classList.add("light")
      document.documentElement.style.colorScheme = "light"
    } else {
      // System: check prefers-color-scheme
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      document.documentElement.classList.add(prefersDark ? "dark" : "light")
      document.documentElement.style.colorScheme = prefersDark ? "dark" : "light"
    }
    setTimeout(() => document.documentElement.classList.remove("transitioning"), 350)
  }

  // Actually persist theme via next-themes (saves to localStorage)
  const commitTheme = (value: string) => {
    document.documentElement.classList.add("transitioning")
    setTheme(value)
    setTimeout(() => document.documentElement.classList.remove("transitioning"), 350)
  }

  // Anthropic credentials (separate API key and subscription)
  const [anthropicApiKey, setAnthropicApiKey] = useState("")
  const [anthropicAuthToken, setAnthropicAuthToken] = useState("")

  // Other API keys
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [opencodeApiKey, setOpencodeApiKey] = useState("")
  const [geminiApiKey, setGeminiApiKey] = useState("")

  // Git preferences
  const [squashOnMerge, setSquashOnMerge] = useState(false)
  const [initialSquashOnMerge, setInitialSquashOnMerge] = useState(false)
  const [prDescriptionMode, setPrDescriptionMode] = useState<PRDescriptionType>("short")
  const [initialPrDescriptionMode, setInitialPrDescriptionMode] = useState<PRDescriptionType>("short")

  // Sandbox settings
  const [sandboxAutoStopInterval, setSandboxAutoStopInterval] = useState(5)
  const [initialAutoStopInterval, setInitialAutoStopInterval] = useState(5)
  const [daytonaApiKey, setDaytonaApiKey] = useState("")

  // Track keys to clear
  const [keysToClear, setKeysToClear] = useState<Set<ClearableKey>>(new Set())

  // UI state
  const [copiedAuth, setCopiedAuth] = useState(false)
  const [copiedCredentials, setCopiedCredentials] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ message: string; isError: boolean } | null>(null)
  const themeChanged = pendingTheme !== initialTheme
  const hasChanges = !!(
    anthropicApiKey.trim() ||
    anthropicAuthToken.trim() ||
    openaiApiKey.trim() ||
    opencodeApiKey.trim() ||
    geminiApiKey.trim() ||
    daytonaApiKey.trim() ||
    keysToClear.size > 0 ||
    sandboxAutoStopInterval !== initialAutoStopInterval ||
    squashOnMerge !== initialSquashOnMerge ||
    prDescriptionMode !== initialPrDescriptionMode ||
    themeChanged
  )

  const [showDaytonaWarning, setShowDaytonaWarning] = useState(false)
  const [daytonaWarningConfirmed, setDaytonaWarningConfirmed] = useState(false)

  // Sync form state when modal opens
  useEffect(() => {
    if (open) {
      setAnthropicApiKey("")
      setAnthropicAuthToken("")
      setOpenaiApiKey("")
      setOpencodeApiKey("")
      setGeminiApiKey("")
      setDaytonaApiKey("")
      setKeysToClear(new Set())
      const interval = credentials?.sandboxAutoStopInterval ?? 5
      setSandboxAutoStopInterval(interval)
      setInitialAutoStopInterval(interval)
      const sq = credentials?.squashOnMerge ?? false
      const pr = (credentials?.prDescriptionMode as PRDescriptionType) ?? "short"
      setSquashOnMerge(sq)
      setInitialSquashOnMerge(sq)
      setPrDescriptionMode(pr)
      setInitialPrDescriptionMode(pr)
      // Track initial theme for cancel/revert
      setInitialTheme(theme)
      setPendingTheme(theme)
      setSaveStatus(null)
      setShowDaytonaWarning(false)
      setDaytonaWarningConfirmed(false)
    }
  }, [open, credentials, theme])

  // Handle highlight field - switch tab and scroll to field
  useEffect(() => {
    if (highlightField && open) {
      // Switch to agents tab if highlighting an agent-related field
      if (["anthropicApiKey", "anthropicAuthToken", "openaiApiKey", "opencodeApiKey", "geminiApiKey"].includes(highlightField)) {
        setActiveTab("agents")
      }
      // Scroll field into view after a short delay to allow tab switch
      setTimeout(() => {
        const fieldElement = document.getElementById(`field-${highlightField}`)
        fieldElement?.scrollIntoView({ behavior: "smooth", block: "center" })
        fieldElement?.focus()
      }, 100)
    }
  }, [highlightField, open])

  if (!open) return null

  function markKeyToClear(key: ClearableKey) {
    setKeysToClear(prev => new Set(prev).add(key))
  }

  function unmarkKeyToClear(key: ClearableKey) {
    setKeysToClear(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  async function handleSave(skipDaytonaWarning = false) {
    const newAnthropicKey = anthropicApiKey.trim()
    const newAuthToken = anthropicAuthToken.trim()
    const newOpenaiKey = openaiApiKey.trim()
    const newOpencodeKey = opencodeApiKey.trim()
    const newGeminiKey = geminiApiKey.trim()
    const newDaytonaKey = daytonaApiKey.trim()
    const autoStopChanged = sandboxAutoStopInterval !== initialAutoStopInterval

    // Check if Daytona key is being changed and show warning (if not already confirmed)
    if ((newDaytonaKey || keysToClear.has("daytonaApiKey")) && !skipDaytonaWarning && !daytonaWarningConfirmed) {
      setShowDaytonaWarning(true)
      return
    }

    // Check if there's anything to save
    const gitPrefsChanged = squashOnMerge !== initialSquashOnMerge || prDescriptionMode !== initialPrDescriptionMode
    const hasAnyChanges =
      newAnthropicKey ||
      newAuthToken ||
      newOpenaiKey ||
      newOpencodeKey ||
      newGeminiKey ||
      newDaytonaKey ||
      autoStopChanged ||
      keysToClear.size > 0 ||
      gitPrefsChanged

    if (!hasAnyChanges) {
      onClose()
      return
    }

    setIsSaving(true)
    setSaveStatus(null)

    try {
      // Build payload with only non-empty values to avoid overwriting existing keys
      const payload: Record<string, unknown> = {}

      // Only include credentials that have been entered (non-empty)
      if (newAnthropicKey) {
        payload.anthropicApiKey = newAnthropicKey
      }
      if (newAuthToken) {
        payload.anthropicAuthToken = newAuthToken
      }
      if (newOpenaiKey) {
        payload.openaiApiKey = newOpenaiKey
      }
      if (newOpencodeKey) {
        payload.opencodeApiKey = newOpencodeKey
      }
      if (newGeminiKey) {
        payload.geminiApiKey = newGeminiKey
      }
      if (newDaytonaKey) {
        payload.daytonaApiKey = newDaytonaKey
      }
      if (autoStopChanged) {
        payload.sandboxAutoStopInterval = sandboxAutoStopInterval
      }

      // Git preferences - always include
      payload.squashOnMerge = squashOnMerge
      payload.prDescriptionMode = prDescriptionMode

      // Add keys to clear (send null to clear them)
      for (const key of keysToClear) {
        payload[key] = null
      }

      const response = await fetch("/api/user/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        setSaveStatus({
          message: data.error || "Failed to save settings",
          isError: true,
        })
        return
      }

      // If auto-stop interval changed, update all existing sandboxes
      if (autoStopChanged) {
        setSaveStatus({
          message: "Updating sandbox timeouts...",
          isError: false,
        })

        const autostopResponse = await fetch("/api/sandbox/autostop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval: sandboxAutoStopInterval }),
        })

        if (!autostopResponse.ok) {
          const autostopData = await autostopResponse.json()
          setSaveStatus({
            message: autostopData.error || "Failed to update sandbox timeouts",
            isError: true,
          })
          return
        }
      }

      // Only trigger full refresh if credentials changed (not just preferences)
      // This prevents wiping chat messages when only changing theme, git prefs, etc.
      const credentialsChanged =
        newAnthropicKey ||
        newAuthToken ||
        newOpenaiKey ||
        newOpencodeKey ||
        newGeminiKey ||
        newDaytonaKey ||
        keysToClear.size > 0

      if (credentialsChanged) {
        await onCredentialsUpdate()
      }

      // Persist theme change if modified (preview was just visual, this saves to localStorage)
      if (pendingTheme && pendingTheme !== initialTheme) {
        commitTheme(pendingTheme)
      }

      onClose()
    } catch {
      setSaveStatus({
        message: "Failed to save settings",
        isError: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to render status indicator
  function renderStatus(hasKey: boolean, keyName: ClearableKey) {
    if (keysToClear.has(keyName)) {
      return <span className="text-destructive text-[10px]">Will be cleared</span>
    }
    if (hasKey) {
      return <span className="text-green-500 text-[10px]">Configured</span>
    }
    return <span className="text-muted-foreground/50 text-[10px]">Not configured</span>
  }

  // Helper to render clear button
  function renderClearButton(hasKey: boolean, keyName: ClearableKey) {
    if (!hasKey || keysToClear.has(keyName)) return null
    return (
      <button
        type="button"
        onClick={() => markKeyToClear(keyName)}
        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1"
        title="Clear this key"
      >
        <Trash2 className="h-3 w-3" />
        Clear
      </button>
    )
  }

  // Helper to render undo clear button
  function renderUndoClearButton(keyName: ClearableKey) {
    if (!keysToClear.has(keyName)) return null
    return (
      <button
        type="button"
        onClick={() => unmarkKeyToClear(keyName)}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        Undo
      </button>
    )
  }

  // Handle cancel - revert theme preview and close
  function handleCancel() {
    if (pendingTheme !== initialTheme && initialTheme) {
      // Revert visual preview (previewTheme only touched DOM, not localStorage)
      previewTheme(initialTheme)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleCancel} />
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <button
            onClick={handleCancel}
            className="flex cursor-pointer h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setActiveTab("agents")}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "agents"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            Agents
          </button>
          <button
            onClick={() => setActiveTab("sandboxes")}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "sandboxes"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Box className="h-3.5 w-3.5" />
            Sandboxes
          </button>
          <button
            onClick={() => setActiveTab("git")}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "git"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Git
          </button>
          <button
            onClick={() => setActiveTab("runtimes")}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "runtimes"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Server className="h-3.5 w-3.5" />
            Runtimes
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "appearance"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            Appearance
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex flex-col gap-4 px-4 sm:px-5 py-4 overflow-y-auto">
          {activeTab === "agents" && (
            <>
              {/* Anthropic API Key */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">Anthropic API Key</label>
                    {renderStatus(credentials?.hasAnthropicApiKey ?? false, "anthropicApiKey")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasAnthropicApiKey ?? false, "anthropicApiKey")}
                    {renderUndoClearButton("anthropicApiKey")}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Input
                  id="field-anthropicApiKey"
                  type="password"
                  placeholder="sk-ant-..."
                  value={anthropicApiKey}
                  onChange={(e) => {
                    setAnthropicApiKey(e.target.value)
                    if (highlightField === "anthropicApiKey") onClearHighlight?.()
                  }}
                  disabled={keysToClear.has("anthropicApiKey")}
                  aria-invalid={highlightField === "anthropicApiKey"}
                  className={cn(
                    "h-9 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40",
                    keysToClear.has("anthropicApiKey") && "opacity-50",
                    highlightField === "anthropicApiKey" && "border-destructive ring-1 ring-destructive"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used by Claude Code and OpenCode agents for Anthropic models
                </p>
              </div>

              {/* Claude Subscription (Max) */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">Claude Subscription</label>
                    {renderStatus(credentials?.hasAnthropicAuthToken ?? false, "anthropicAuthToken")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasAnthropicAuthToken ?? false, "anthropicAuthToken")}
                    {renderUndoClearButton("anthropicAuthToken")}
                    <a
                      href="https://claude.ai/settings/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Manage <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <textarea
                  id="field-anthropicAuthToken"
                  placeholder='{"claudeAiOauth":{"token_type":"bearer",...}}'
                  value={anthropicAuthToken}
                  onChange={(e) => {
                    setAnthropicAuthToken(e.target.value)
                    if (highlightField === "anthropicAuthToken") onClearHighlight?.()
                  }}
                  disabled={keysToClear.has("anthropicAuthToken")}
                  rows={3}
                  aria-invalid={highlightField === "anthropicAuthToken"}
                  className={cn(
                    "w-full rounded-md bg-secondary border border-border px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/40 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    keysToClear.has("anthropicAuthToken") && "opacity-50",
                    highlightField === "anthropicAuthToken" && "border-destructive ring-1 ring-destructive"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  First sign in with:{" "}
                  <code
                    className="text-[10px] cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText('claude auth login')
                      setCopiedAuth(true)
                      setTimeout(() => setCopiedAuth(false), 1500)
                    }}
                  >
                    {copiedAuth
                      ? <Check className="inline h-2.5 w-2.5 text-green-500 mr-1 align-middle" />
                      : <Copy className="inline h-2.5 w-2.5 text-muted-foreground/60 mr-1 align-middle" />}
                    claude auth login
                  </code>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Then, paste the output of:{" "}
                  <code
                    className="text-[10px] cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText('security find-generic-password -s "Claude Code-credentials" -w')
                      setCopiedCredentials(true)
                      setTimeout(() => setCopiedCredentials(false), 1500)
                    }}
                  >
                    {copiedCredentials
                      ? <Check className="inline h-2.5 w-2.5 text-green-500 mr-1 align-middle" />
                      : <Copy className="inline h-2.5 w-2.5 text-muted-foreground/60 mr-1 align-middle" />}
                    security find-generic-password -s &quot;Claude Code-credentials&quot; -w
                  </code>
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  Claude Code agent only. Not compatible with other agents.
                </p>
              </div>

              {/* OpenAI API Key */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">OpenAI API Key</label>
                    {renderStatus(credentials?.hasOpenaiApiKey ?? false, "openaiApiKey")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasOpenaiApiKey ?? false, "openaiApiKey")}
                    {renderUndoClearButton("openaiApiKey")}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Input
                  id="field-openaiApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => {
                    setOpenaiApiKey(e.target.value)
                    if (highlightField === "openaiApiKey") onClearHighlight?.()
                  }}
                  disabled={keysToClear.has("openaiApiKey")}
                  aria-invalid={highlightField === "openaiApiKey"}
                  className={cn(
                    "h-9 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40",
                    keysToClear.has("openaiApiKey") && "opacity-50",
                    highlightField === "openaiApiKey" && "border-destructive ring-1 ring-destructive"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used by Codex and OpenCode agents for OpenAI models
                </p>
              </div>

              {/* OpenCode API Key */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">OpenCode API Key</label>
                    {renderStatus(credentials?.hasOpencodeApiKey ?? false, "opencodeApiKey")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasOpencodeApiKey ?? false, "opencodeApiKey")}
                    {renderUndoClearButton("opencodeApiKey")}
                    <a
                      href="https://opencode.ai/auth"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Input
                  id="field-opencodeApiKey"
                  type="password"
                  placeholder="oc-..."
                  value={opencodeApiKey}
                  onChange={(e) => {
                    setOpencodeApiKey(e.target.value)
                    if (highlightField === "opencodeApiKey") onClearHighlight?.()
                  }}
                  disabled={keysToClear.has("opencodeApiKey")}
                  aria-invalid={highlightField === "opencodeApiKey"}
                  className={cn(
                    "h-9 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40",
                    keysToClear.has("opencodeApiKey") && "opacity-50",
                    highlightField === "opencodeApiKey" && "border-destructive ring-1 ring-destructive"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used by OpenCode agent for paid models
                </p>
              </div>

              {/* Gemini API Key */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">Gemini API Key</label>
                    {renderStatus(credentials?.hasGeminiApiKey ?? false, "geminiApiKey")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasGeminiApiKey ?? false, "geminiApiKey")}
                    {renderUndoClearButton("geminiApiKey")}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Input
                  id="field-geminiApiKey"
                  type="password"
                  placeholder="AIza..."
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value)
                    if (highlightField === "geminiApiKey") onClearHighlight?.()
                  }}
                  disabled={keysToClear.has("geminiApiKey")}
                  aria-invalid={highlightField === "geminiApiKey"}
                  className={cn(
                    "h-9 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40",
                    keysToClear.has("geminiApiKey") && "opacity-50",
                    highlightField === "geminiApiKey" && "border-destructive ring-1 ring-destructive"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used by Gemini agent for Google AI models
                </p>
              </div>

            </>
          )}

          {activeTab === "sandboxes" && (
            <>
              {/* Info about Daytona */}
              <p className="text-[11px] text-muted-foreground">
                Sandboxes are powered by{" "}
                <a
                  href="https://www.daytona.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline"
                >
                  Daytona
                </a>
                . Each agent runs in an isolated cloud development environment.
              </p>

              {/* Custom Daytona API Key */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <label className="text-xs font-medium text-foreground">Daytona API Key</label>
                    <span className="text-[10px] text-muted-foreground/70">(Optional)</span>
                    {renderStatus(credentials?.hasDaytonaApiKey ?? false, "daytonaApiKey")}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderClearButton(credentials?.hasDaytonaApiKey ?? false, "daytonaApiKey")}
                    {renderUndoClearButton("daytonaApiKey")}
                    <a
                      href="https://app.daytona.io/dashboard/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Input
                  type="password"
                  placeholder="dtn_..."
                  value={daytonaApiKey}
                  onChange={(e) => {
                    setDaytonaApiKey(e.target.value)
                    setShowDaytonaWarning(false)
                  }}
                  disabled={keysToClear.has("daytonaApiKey")}
                  className={cn(
                    "h-9 bg-secondary border-border text-xs font-mono placeholder:text-muted-foreground/40",
                    keysToClear.has("daytonaApiKey") && "opacity-50"
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Use your own Daytona account for sandboxes
                </p>
              </div>

              {/* Sandbox Auto-Stop */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <label className="text-xs font-medium text-foreground">Auto-Stop Timeout</label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={20}
                    value={sandboxAutoStopInterval}
                    onChange={(e) => setSandboxAutoStopInterval(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <span className="text-xs font-medium text-foreground w-16 text-right">{sandboxAutoStopInterval} min</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sandboxes will auto-stop after {sandboxAutoStopInterval} minutes of inactivity
                </p>
              </div>
            </>
          )}

          {activeTab === "git" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">Squash on merge</span>
                  <span className="text-[11px] text-muted-foreground">Squash commits when merging PRs</span>
                </div>
                <button
                  onClick={() => setSquashOnMerge(!squashOnMerge)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
                    squashOnMerge ? "bg-primary" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5",
                    squashOnMerge ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">Default PR description</span>
                <span className="text-[11px] text-muted-foreground">Default format for pull request descriptions</span>
                <div className="flex flex-wrap gap-2">
                  {prDescriptionTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setPrDescriptionMode(type)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                        prDescriptionMode === type
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                      )}
                    >
                      {PR_DESCRIPTION_LABELS[type].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "runtimes" && (
            <RuntimesTab />
          )}

          {activeTab === "appearance" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Theme</label>
                <p className="text-[11px] text-muted-foreground">
                  Choose how the app looks. System will match your OS preference.
                </p>
              </div>
              <div className="flex gap-2">
                {([
                  { value: "system", label: "System", icon: Monitor },
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setPendingTheme(value)
                      previewTheme(value)
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      pendingTheme === value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          {/* Save status */}
          <div className="flex items-center gap-2 text-xs">
            {isSaving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            )}
            {saveStatus && !isSaving && (
              <span className={saveStatus.isError ? "text-destructive" : "text-green-500"}>
                {saveStatus.message}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave()}
              disabled={isSaving || !hasChanges}
              className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Daytona API Key Change Confirmation Modal */}
      {showDaytonaWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            onClick={() => setShowDaytonaWarning(false)}
          />
          <div className="relative z-10 flex w-full max-w-sm flex-col rounded-xl border border-destructive/30 bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delete All Sandboxes?</h3>
                <p className="text-[11px] text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {keysToClear.has("daytonaApiKey")
                  ? "Clearing your Daytona API key will permanently delete all existing sandboxes and their conversation history. Sandboxes will use the platform key going forward."
                  : "Changing your Daytona API key will permanently delete all existing sandboxes and their conversation history. New sandboxes will be created using your new API key."}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                onClick={() => setShowDaytonaWarning(false)}
                className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDaytonaWarning(false)
                  setDaytonaWarningConfirmed(true)
                  handleSave(true)
                }}
                disabled={isSaving}
                className="cursor-pointer rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// RuntimesTab — self-contained sub-component
// =============================================================================

function RuntimesTab() {
  const [runtimes, setRuntimes] = useState<RuntimeRecord[]>([])
  const [agents, setAgents] = useState<AgentProfileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Agent profile form
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentName, setAgentName] = useState("")
  const [agentSlug, setAgentSlug] = useState("")
  const [agentKind, setAgentKind] = useState("claude-code")
  const [agentRuntimeId, setAgentRuntimeId] = useState("")
  const [savingAgent, setSavingAgent] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [rRes, aRes] = await Promise.all([
      fetch("/api/runtimes"),
      fetch("/api/agent-profiles"),
    ])
    if (rRes.ok) setRuntimes((await rRes.json()).runtimes)
    if (aRes.ok) setAgents((await aRes.json()).profiles)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerateToken = async () => {
    setGeneratingToken(true)
    const res = await fetch("/api/runtimes/token", { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      setSetupToken(data.token)
    }
    setGeneratingToken(false)
  }

  const handleCopyToken = () => {
    if (!setupToken) return
    navigator.clipboard.writeText(setupToken)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 2000)
  }

  const handleDeleteRuntime = async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/runtimes?id=${id}`, { method: "DELETE" })
    setRuntimes((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentName.trim() || !agentSlug.trim()) return
    setSavingAgent(true)
    const res = await fetch("/api/agent-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agentName.trim(),
        slug: agentSlug.trim(),
        kind: agentKind,
        runtimeId: agentRuntimeId || undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setAgents((prev) => [...prev, data.profile])
      setAgentName(""); setAgentSlug(""); setAgentRuntimeId(""); setShowAgentForm(false)
    }
    setSavingAgent(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

  return (
    <div className="flex flex-col gap-5">
      {/* ── Connected Runtimes ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Connected Runtimes</span>
          </div>
          <button onClick={fetchData} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {runtimes.length === 0 ? (
          <p className="text-[11px] text-muted-foreground rounded-md border border-dashed border-border px-3 py-3 text-center">
            No runtimes connected yet. Generate a setup token below.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {runtimes.map((r) => {
              const isOnline = r.status === "online"
              const caps = (r.capabilities as {
                agents?: string[]
                agentVersions?: Record<string, string | null>
              } | null) ?? null
              const agents = caps?.agents ?? []
              const agentSummary = agents
                .map((a) => {
                  const v = caps?.agentVersions?.[a]
                  return v ? `${a}@${v}` : a
                })
                .join(", ")
              return (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isOnline
                      ? <Wifi className="h-3 w-3 shrink-0 text-green-500" />
                      : <WifiOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {agents.length > 0 ? agentSummary : r.kind}
                        {r.lastHeartbeat && ` · ${new Date(r.lastHeartbeat).toLocaleTimeString()}`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRuntime(r.id)}
                    disabled={deletingId === r.id}
                    className="cursor-pointer ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    {deletingId === r.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Generate Setup Token */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleGenerateToken}
            disabled={generatingToken}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {generatingToken ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
            Generate setup token
          </button>

          {setupToken && (
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 p-3">
              <p className="text-[10px] text-muted-foreground">Run this command on your local machine:</p>
              <div className="flex items-center gap-2 rounded-md bg-background border border-border px-2 py-1.5 font-mono text-[10px] text-foreground overflow-x-auto">
                <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">charclaw setup --server {serverUrl} --token {setupToken}</span>
                <button onClick={handleCopyToken} className="cursor-pointer shrink-0 text-muted-foreground hover:text-foreground ml-auto">
                  {tokenCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                ⚠ Token is single-use and expires after registration.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Agent Profiles ── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Agent Profiles</span>
          </div>
          <button
            onClick={() => setShowAgentForm((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New agent
          </button>
        </div>

        {agents.length === 0 && !showAgentForm && (
          <p className="text-[11px] text-muted-foreground rounded-md border border-dashed border-border px-3 py-3 text-center">
            No agents yet. Create one to assign issues on the board.
          </p>
        )}

        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
              {a.name[0].toUpperCase()}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground">{a.name}</span>
              <span className="text-[10px] text-muted-foreground">{a.kind}{a.model ? ` · ${a.model}` : ""}</span>
            </div>
          </div>
        ))}

        {showAgentForm && (
          <form onSubmit={handleCreateAgent} className="flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-3">
            <div className="flex gap-2">
              <input
                placeholder="Name (e.g. Aria)"
                value={agentName}
                onChange={(e) => {
                  setAgentName(e.target.value)
                  if (!agentSlug) setAgentSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
                }}
                required
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                placeholder="slug"
                value={agentSlug}
                onChange={(e) => setAgentSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={agentKind}
                onChange={(e) => setAgentKind(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="gemini">Gemini</option>
                <option value="goose">Goose</option>
                <option value="opencode">OpenCode</option>
              </select>
              <select
                value={agentRuntimeId}
                onChange={(e) => setAgentRuntimeId(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">No runtime</option>
                {runtimes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAgentForm(false)} className="cursor-pointer px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
              <button type="submit" disabled={savingAgent} className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {savingAgent && <Loader2 className="h-3 w-3 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
