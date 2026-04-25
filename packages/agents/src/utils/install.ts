/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type { ProviderName } from "../types/provider.js"

const PACKAGE_NAMES: Partial<Record<ProviderName, string>> = {
  claude: "@anthropic-ai/claude-code",
  codex: "@openai/codex",
  gemini: "@google/gemini-cli",
  opencode: "opencode-ai",
  pi: "@badlogic/pi-coding-agent",
}

const SHELL_INSTALLERS: Partial<Record<ProviderName, string>> = {
  goose:
    'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh ' +
    '| CONFIGURE=false bash',
}

const BINARY_NAMES: Partial<Record<ProviderName, string>> = {
  claude: "claude",
  codex: "codex",
  gemini: "gemini",
  goose: "goose",
  opencode: "opencode",
  pi: "pi",
  mock: "charclaw-mock",
}

export function getPackageName(name: ProviderName): string | undefined {
  return PACKAGE_NAMES[name]
}

export function getShellInstaller(name: ProviderName): string | undefined {
  return SHELL_INSTALLERS[name]
}

export function getBinaryName(name: ProviderName): string {
  return BINARY_NAMES[name] ?? name
}

export function getInstallationStatus(name: ProviderName): {
  packageName: string | undefined
  shellInstaller: string | undefined
  binary: string
} {
  return {
    packageName: getPackageName(name),
    shellInstaller: getShellInstaller(name),
    binary: getBinaryName(name),
  }
}

export interface InstallProviderOptions {
  exec: (cmd: string, timeoutSec?: number) => Promise<{ exitCode: number; output: string }>
  timeoutSec?: number
}

export async function installProvider(
  name: ProviderName,
  opts: InstallProviderOptions,
): Promise<void> {
  const shellInstaller = getShellInstaller(name)
  const packageName = getPackageName(name)

  if (!shellInstaller && !packageName) return

  const cmd = shellInstaller ?? `npm install -g ${packageName}`
  const result = await opts.exec(cmd, opts.timeoutSec ?? 180)
  if (result.exitCode !== 0) {
    const tail = result.output.slice(-500)
    throw new Error(`Failed to install ${name}: ${tail}`)
  }
}

export async function isCliInstalled(
  name: ProviderName,
  exec: (cmd: string) => Promise<{ exitCode: number; output: string }>,
): Promise<boolean> {
  const binary = getBinaryName(name)
  const result = await exec(
    process.platform === "win32"
      ? `where ${binary}`
      : `command -v ${binary} || which ${binary} || test -x "$HOME/.local/bin/${binary}"`,
  )
  return result.exitCode === 0
}

export async function ensureCliInstalled(
  name: ProviderName,
  opts: InstallProviderOptions,
): Promise<void> {
  if (await isCliInstalled(name, opts.exec)) return
  await installProvider(name, opts)
}
