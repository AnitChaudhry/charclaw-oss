# Agent instructions

Primary reference for coding agents working in this repo.

## Setting up a freshly-cloned repo

If a user asks you to "set up CharClaw" or "install it for me," execute the one-command setup script that matches the host OS:

```bash
# macOS, Linux, or Windows Git Bash:
bash scripts/setup.sh

# Windows PowerShell:
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Then start the dev stack (web + daemon together):

```bash
npm run dev
```

Finally, open <http://localhost:3000/setup> in a browser to complete in-app onboarding (pick runtime, install CLIs, add AI keys). The page self-reports what's missing.

Common gotchas:

- `DATABASE_URL` needs to be set in `packages/web/.env` before `scripts/setup.sh` can apply the Prisma schema. If it's still the template placeholder, the script prints install commands for Postgres (Homebrew / apt / winget) and exits so the user can fill it in, then re-run.
- On Windows **without WSL**, the daemon needs **Git for Windows** (bash.exe) on PATH. `packages/agents/src/sandbox/local.ts` detects this and falls back gracefully; just make sure Git for Windows is installed.
- Agent CLI detection runs in the daemon on startup via `where` (Windows) or `which` (POSIX). Installing a CLI after the daemon started requires a daemon restart.

## Where to look

- **Tests** (unit, database for E2E, Playwright): [TESTING.md](./TESTING.md)
- **Development server** details: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Production deploy** (OAuth app, GitHub Secrets, Vercel Cron for autopilots): [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture, features, FAQ**: [README.md](./README.md)

## Conventions agents should follow

- Edit existing files rather than creating parallels
- Don't commit `.env` or any file matching `*.tsbuildinfo`
- Don't add Vercel-specific code (analytics, middleware) — the app is intentionally runtime-agnostic
- Don't add `GITHUB_PAT` in production — it's a dev-only bypass gated on `NODE_ENV !== "production"`
- Before a schema change, ensure `packages/web/prisma/schema.prisma` validates (`npx prisma validate`) and a migration SQL file is written under `packages/web/prisma/migrations/`
