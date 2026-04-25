/**
 * Skill extraction — after a session completes, summarise it into a reusable playbook.
 * Fires asynchronously so it never blocks the response path.
 */

import { generateWithUserLLM } from "@/lib/llm/llm"
import { prisma } from "@/lib/db/prisma"

interface ExtractionInput {
  executionId: string
  userId: string
  /** Final assistant message content */
  content: string
  /** Tool call names observed during the session */
  toolCallNames?: string[]
  /** Branch + repo context for tagging */
  branchName?: string
  repoName?: string
}

interface ExtractedSkill {
  title: string
  description: string
  steps: { action: string; command?: string; notes?: string }[]
  tags: string[]
}

const EXTRACTION_PROMPT = (content: string, context: string) => `
You are extracting a reusable skill from a completed AI coding agent session.

Context: ${context}

Session output (truncated to 4000 chars):
---
${content.slice(0, 4000)}
---

Extract a reusable skill playbook in JSON with this exact shape:
{
  "title": "short title (max 60 chars)",
  "description": "1-2 sentence description of what this skill does",
  "steps": [
    { "action": "step description", "command": "optional shell command", "notes": "optional notes" }
  ],
  "tags": ["tag1", "tag2"]
}

Rules:
- Only extract if the session completed real work (not just questions/chat)
- steps should be concrete and reproducible
- tags should be lowercase keywords (e.g. "prisma", "migration", "docker", "testing")
- Return ONLY valid JSON, no markdown fences, no explanation

If the session did not produce a reusable skill, return: {"skip": true}
`.trim()

export async function extractSkillFromSession(input: ExtractionInput): Promise<void> {
  if (!input.content || input.content.length < 200) return

  const context = [
    input.repoName && `repo: ${input.repoName}`,
    input.branchName && `branch: ${input.branchName}`,
  ]
    .filter(Boolean)
    .join(", ")

  try {
    const result = await generateWithUserLLM({
      userId: input.userId,
      prompt: EXTRACTION_PROMPT(input.content, context),
    })

    if (!result.text) return

    let parsed: ExtractedSkill & { skip?: boolean }
    try {
      parsed = JSON.parse(result.text)
    } catch {
      console.warn("[skill-extract] Could not parse LLM response:", result.text.slice(0, 200))
      return
    }

    if (parsed.skip) return
    if (!parsed.title || !parsed.steps?.length) return

    await prisma.skill.create({
      data: {
        userId: input.userId,
        title: parsed.title.slice(0, 120),
        description: parsed.description ?? null,
        steps: parsed.steps,
        tags: parsed.tags ?? [],
        sourceSessionId: input.executionId,
      },
    })

    console.log(`[skill-extract] Saved skill "${parsed.title}" from execution ${input.executionId}`)
  } catch (err) {
    // Non-critical — never throw into the execution path
    console.warn("[skill-extract] Extraction failed:", err instanceof Error ? err.message : err)
  }
}

/**
 * Fire-and-forget wrapper. Safe to call from persistExecutionCompletion.
 */
export function scheduleSkillExtraction(input: ExtractionInput): void {
  setImmediate(() => {
    extractSkillFromSession(input).catch((err) =>
      console.warn("[skill-extract] Uncaught:", err)
    )
  })
}
