/*
 * CharClaw Agents SDK
 * Copyright (C) 2026 Anit Chaudhary
 * Licensed under AGPL-3.0-or-later — see LICENSE.
 */

import { register } from "../core/registry.js"
import { claudeAgent } from "./claude/index.js"
import { codexAgent } from "./codex/index.js"
import { geminiAgent } from "./gemini/index.js"
import { gooseAgent } from "./goose/index.js"
import { opencodeAgent } from "./opencode/index.js"
import { piAgent } from "./pi/index.js"
import { mockAgent } from "./mock/index.js"

register(claudeAgent)
register(codexAgent)
register(geminiAgent)
register(gooseAgent)
register(opencodeAgent)
register(piAgent)
register(mockAgent)

export {
  claudeAgent,
  codexAgent,
  geminiAgent,
  gooseAgent,
  opencodeAgent,
  piAgent,
  mockAgent,
}
