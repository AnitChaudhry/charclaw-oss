#!/usr/bin/env node
/**
 * Daemon dev launcher. Gracefully handles the two common states:
 *
 *   1. `~/.charclaw/config.json` exists — daemon is registered. Exec tsx
 *      in watch mode to start it alongside the web dev server.
 *   2. No config — daemon hasn't been registered yet. Print a friendly
 *      hint with the setup command and exit 0 (so `concurrently` doesn't
 *      tear down the whole pipeline; the web server continues to run
 *      and the user can register the daemon later without restarting).
 *
 * Intended to be wired into the monorepo-root `npm run dev`.
 */

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const CONFIG_PATH = resolve(homedir(), ".charclaw", "config.json")
const here = dirname(fileURLToPath(import.meta.url))
const daemonRoot = resolve(here, "..")

function ansi(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`
}

if (!existsSync(CONFIG_PATH)) {
  console.log("")
  console.log(ansi("[daemon]", "35") + " Not registered yet — skipping auto-start.")
  console.log(
    ansi("[daemon]", "35") +
      " To register: open http://localhost:3000/setup and follow step 2,",
  )
  console.log(
    ansi("[daemon]", "35") +
      " or run:  " +
      ansi(
        "npx tsx packages/daemon/src/index.ts setup --server http://localhost:3000 --token <TOKEN>",
        "36",
      ),
  )
  console.log(ansi("[daemon]", "35") + " The web dev server will keep running.")
  console.log("")
  process.exit(0)
}

console.log(ansi("[daemon]", "35") + " Config found — starting daemon in watch mode.")

// `npx tsx watch ...` — tsx picks up source changes and restarts the daemon.
const child = spawn(
  "npx",
  ["tsx", "watch", "src/index.ts", "start"],
  {
    cwd: daemonRoot,
    stdio: "inherit",
    shell: true, // needed on Windows to resolve npx
  },
)

child.on("exit", (code) => process.exit(code ?? 0))
process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
