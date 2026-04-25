# Deploying CharClaw

A practical checklist for standing up a public or team instance.

> **Just trying it locally?** Run the one-command setup: `bash scripts/setup.sh` (macOS/Linux/Git Bash) or `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` (Windows), then `npm run dev`. The in-app onboarding at <http://localhost:3000/setup> walks you through the rest. This document is for **hosting it for others**.

---

## 1 · Register a GitHub OAuth App

GitHub's REST API does **not** expose OAuth-app creation — this step requires the web UI. Direct link with the fields pre-filled:

<https://github.com/settings/applications/new?oauth_application%5Bname%5D=CharClaw&oauth_application%5Burl%5D=https%3A%2F%2Fcharclaw.vercel.app&oauth_application%5Bcallback_url%5D=https%3A%2F%2Fcharclaw.vercel.app%2Fapi%2Fauth%2Fcallback%2Fgithub>

After creating:

1. **Generate a new client secret** on the app's page.
2. Copy the Client ID and Client Secret into GitHub repo secrets — **GitHub reserves the `GITHUB_*` secret name prefix**, so store them under `OAUTH_GITHUB_*` and map back to `GITHUB_*` when setting runtime env:
   ```bash
   echo "Ov23…yourClientId"      | gh secret set OAUTH_GITHUB_CLIENT_ID     --repo AnitChaudhry/CharClaw-App
   echo "ead8…yourClientSecret"  | gh secret set OAUTH_GITHUB_CLIENT_SECRET --repo AnitChaudhry/CharClaw-App
   ```
   In your deploy workflow / platform env, alias them:
   ```yaml
   env:
     GITHUB_CLIENT_ID:     ${{ secrets.OAUTH_GITHUB_CLIENT_ID }}
     GITHUB_CLIENT_SECRET: ${{ secrets.OAUTH_GITHUB_CLIENT_SECRET }}
   ```
   (Or just paste the values directly into Vercel / Fly / your VM env as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` — those aren't GitHub Actions, so the prefix rule doesn't apply.)
3. Scopes (`repo`, `read:user`) are requested by `lib/auth/auth.ts`; nothing to configure on the GitHub side.

If your production domain differs from `charclaw.vercel.app`, edit the callback URL on the OAuth app page afterward.

---

## 2 · Generate production secrets

Run these locally and paste the output into your deployment platform's env var store — **do not commit them to git**:

```bash
# NEXTAUTH_SECRET — signs session JWTs. Rotating logs everyone out.
openssl rand -base64 32

# ENCRYPTION_KEY — encrypts every stored user API key.
# LOSING OR ROTATING THIS BRICKS EVERY USER'S STORED CREDENTIALS.
# Back it up at least as carefully as a database encryption key.
openssl rand -hex 32

# AUTOPILOT_CRON_SECRET — auth for /api/cron/autopilots/tick.
openssl rand -hex 32
```

> **Already staged:** `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, and `AUTOPILOT_CRON_SECRET` are pre-populated as **GitHub Actions repo secrets** on `AnitChaudhry/CharClaw-App`. List with `gh secret list --repo AnitChaudhry/CharClaw-App`. If you deploy from GitHub Actions, they're available as `${{ secrets.NEXTAUTH_SECRET }}` etc. If you deploy to Vercel / Fly / a VM, copy them from your records (GitHub Secrets are write-only so you can't read them back after setting). Rotate with `echo "$(openssl rand -base64 32)" | gh secret set NEXTAUTH_SECRET --repo AnitChaudhry/CharClaw-App`.
>
> The **`CHARCLAW_SERVER_URL`** repo variable is seeded at `https://charclaw.vercel.app` as a placeholder. Update with `gh variable set CHARCLAW_SERVER_URL --body https://your-domain.com --repo AnitChaudhry/CharClaw-App`.

---

## 3 · Configure production env vars

Set these on your hosting platform (Vercel, Fly, Railway, your own VM):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Connection string to your production Postgres (pooled) |
| `DATABASE_URL_UNPOOLED` | Direct connection (for migrations) |
| `NEXTAUTH_URL` | Your public URL, e.g. `https://app.charclaw.ai` |
| `NEXTAUTH_SECRET` | From step 2 |
| `GITHUB_CLIENT_ID` | From step 1 |
| `GITHUB_CLIENT_SECRET` | From step 1 |
| `ENCRYPTION_KEY` | From step 2 (back this up!) |
| `AUTOPILOT_CRON_SECRET` | From step 2 |
| `NODE_ENV` | `production` |

**Do NOT set `GITHUB_PAT` in production.** Its presence (when `NODE_ENV !== "production"`) turns on the dev-auth bypass and grants every visitor the seeded dev user's session.

---

## 4 · Deploy the database

On first deploy:

```bash
DATABASE_URL="..." \
  npx prisma migrate deploy --schema packages/web/prisma/schema.prisma
```

On subsequent deploys, the same command applies any pending migrations idempotently.

---

## 5 · Deploy the web app

CharClaw's web package is a standard Next.js 16 App Router app. Build + start:

```bash
npm install
npm run -w @charclaw/web build
npm run -w @charclaw/web start
```

On Vercel: point the project at `packages/web`. On a VM: use `pm2` / `systemd` to keep `next start` alive.

---

## 6 · Wire up Autopilot cron

Autopilots fire on `/api/cron/autopilots/tick`. The endpoint requires an `Authorization: Bearer $AUTOPILOT_CRON_SECRET` header.

- **Vercel**: add a Vercel Cron entry pointed at `/api/cron/autopilots/tick` with the secret header.
- **VM**: cron job like `*/5 * * * * curl -fsS -H "Authorization: Bearer $AUTOPILOT_CRON_SECRET" https://your-domain.com/api/cron/autopilots/tick > /dev/null`.

Tick frequency ≥ once every 5 minutes. A single tick scans all workspaces' due autopilots and fires them in order.

---

## 7 · Build + ship the desktop app (optional)

The Electron app is a thin wrapper that loads your hosted backend. Build it with the backend URL baked in:

```bash
# macOS universal DMG
CHARCLAW_SERVER_URL=https://app.charclaw.ai \
  npm run build:mac -w @charclaw/desktop

# Windows NSIS installer
CHARCLAW_SERVER_URL=https://app.charclaw.ai \
  npm run build:win -w @charclaw/desktop

# Linux AppImage
CHARCLAW_SERVER_URL=https://app.charclaw.ai \
  npm run build:linux -w @charclaw/desktop
```

Artifacts land in `packages/desktop/release/`. Sign them with your platform's tooling before distributing.

---

## 8 · Rotate your dev PAT

If you were developing locally with `GITHUB_PAT` in `packages/web/.env` and that machine was shared or the folder was backed up somewhere indexed:

1. Go to <https://github.com/settings/tokens>.
2. Revoke the classic token you were using.
3. Generate a new one with the same scopes (`repo`, `read:user`).
4. Replace the value in `packages/web/.env`.

The file is gitignored, but "gitignored" is not the same as "deleted." GitHub's API does not expose creating Personal Access Tokens programmatically — the UI is the only path. If you're using `gh auth token` as your dev PAT (as CharClaw's bootstrap script does), `gh auth refresh` gives you a new OAuth token instead; it's a different surface but equivalent for local dev.

---

## 9 · Smoke test

After deploy, from your laptop:

```bash
# Sign-in page should load
curl -sI https://your-domain.com/login     # → 200

# GitHub OAuth start should redirect you to github.com
curl -sI https://your-domain.com/api/auth/signin/github     # → 302 to github.com

# /api/auth/dev-mode should report disabled in prod
curl -s https://your-domain.com/api/auth/dev-mode     # → {"enabled":false}

# Workspace-scoped routes should require auth
curl -sI https://your-domain.com/api/workspaces     # → 401
```

If `/api/auth/dev-mode` returns `{"enabled":true}` in production, you accidentally shipped `GITHUB_PAT` — remove it from your prod env immediately.

---

## 10 · Rename the local workspace folder

The on-disk folder is still named `upfyn-stream-agents`. To rename it to `charclaw`:

```bash
# From a shell NOT currently CWD inside the folder, after closing all
# editors, dev servers, and running daemons that reference it:
bash upfyn-stream-agents/scripts/rename-workspace.sh
```

The script refuses to run if the target already exists or if you're still CWD inside the source.

---

## 11 · Known limitations

- On upgrade from an older CharClaw build, any previously-created Daytona sandboxes were labeled `upstream-agents`. The code now tags new sandboxes `charclaw`, so the upgraded workspace will only show *newly-created* sandboxes. Old ones are still alive on Daytona but orphaned from the UI — if you have any, clean them up from the Daytona dashboard.
- Same migration story for MCP server authorizations: the OAuth client_id fallback moved from `upstream-agents` to `charclaw`. Existing authorized MCP servers may need to re-authorize once.

For a fresh install, neither applies.

---

## 12 · Licensing notes for hosters

CharClaw is **dual-licensed**:

| Surface | License | What it means for you |
|---|---|---|
| App (web, daemon, desktop, landing, simple-chat, common, terminal) | Apache 2.0 | Fork, rebrand, host commercially, no obligations beyond preserving copyright notices. |
| Agent SDK (`@charclaw/agents`) | AGPL-3.0-or-later | Pulling unmodified `@charclaw/agents` from npm has zero AGPL impact. **If you modify the SDK source and run the modified version as a service users interact with over a network**, you must offer your modifications under AGPL-3.0 too. If that doesn't fit your business model, email `anitc98@gmail.com` for a commercial license.

Most hosters never modify `packages/agents/` and just consume the npm package — the AGPL clause is dormant in that case. Lock down the SDK version (`"@charclaw/agents": "0.2.0"`) in your `package.json` if you want absolute confidence the upstream can't pull you into copyleft territory by sneaking modified code into a future release.
