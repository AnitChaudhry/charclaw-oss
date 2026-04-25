/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import type { AgentDefinition } from "./agent.js"
import type { ProviderName } from "../types/provider.js"

const REGISTRY = new Map<ProviderName, AgentDefinition>()

export function register(def: AgentDefinition): void {
  REGISTRY.set(def.name, def)
}

export function getAgent(name: ProviderName): AgentDefinition {
  const def = REGISTRY.get(name)
  if (!def) {
    throw new Error(
      `Unknown agent provider "${name}". Registered: ${[...REGISTRY.keys()].join(", ") || "(none)"}`,
    )
  }
  return def
}

export function getAgentNames(): ProviderName[] {
  return [...REGISTRY.keys()]
}

export const registry = {
  register,
  get: getAgent,
  names: getAgentNames,
}
