# CharClaw — one-command local setup for Windows PowerShell users.
# Use this when you don't have Git Bash; the behavior matches scripts/setup.sh.
# Usage from repo root:   powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$ErrorActionPreference = "Stop"

function Info($msg)    { Write-Host $msg -ForegroundColor White }
function Good($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Fail($msg)    { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Step($msg)    { Write-Host ""; Write-Host $msg -ForegroundColor Cyan }
function Dim($msg)     { Write-Host $msg -ForegroundColor DarkGray }

Write-Host ""
Write-Host "🐍 CharClaw Setup" -ForegroundColor Cyan
Write-Host "==============="
Write-Host ""
Dim "Detected OS: Windows (PowerShell)"

# ───── Node.js ────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js not found. Install from https://nodejs.org (v18+)"
}
$nodeVer = (node -v).TrimStart("v").Split(".")[0]
if ([int]$nodeVer -lt 18) {
  Fail "Node.js v18+ required (found $(node -v))"
}
Good "Node.js $(node -v)"

# ───── Git ────────────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "Git not found. Install from https://git-scm.com"
}
Good "Git installed"

# ───── Dependencies ───────────────────────────────────────────────────────
Step "📦 Installing dependencies…"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
Good "Dependencies installed"

# ───── Env file ───────────────────────────────────────────────────────────
$EnvFile = "packages\web\.env"
$EnvExample = ".env.example"

if (-not (Test-Path $EnvFile)) {
  Warn "No $EnvFile — seeding from $EnvExample"
  Copy-Item $EnvExample $EnvFile

  $nextauth = & node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  $encKey   = & node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  $cronKey  = & node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  (Get-Content $EnvFile) `
    -replace '^NEXTAUTH_SECRET=.*', ('NEXTAUTH_SECRET="' + $nextauth + '"') `
    -replace '^ENCRYPTION_KEY=.*',  ('ENCRYPTION_KEY="'  + $encKey   + '"') `
    -replace '^AUTOPILOT_CRON_SECRET=.*', ('AUTOPILOT_CRON_SECRET="' + $cronKey + '"') |
    Set-Content $EnvFile -Encoding utf8

  Good "Generated NEXTAUTH_SECRET, ENCRYPTION_KEY, AUTOPILOT_CRON_SECRET"
  Dim "  Back these up — losing ENCRYPTION_KEY bricks every user's stored API keys."
} else {
  Good "$EnvFile already exists — keeping your values"
}

# ───── Database check ─────────────────────────────────────────────────────
$dbLine = (Select-String -Path $EnvFile -Pattern '^DATABASE_URL=').Line
$dbUrl = if ($dbLine) { ($dbLine -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', '') } else { "" }

if (-not $dbUrl -or $dbUrl -like "*REPLACE_ME*" -or $dbUrl -like "*user:password@host*") {
  Warn "DATABASE_URL not set in $EnvFile"
  Write-Host ""
  Write-Host "  Pick one and paste its connection string into $EnvFile :"
  Write-Host "    • Neon (free, hosted)  → https://neon.tech/signup" -ForegroundColor Blue
  Write-Host "    • Supabase (free)      → https://supabase.com" -ForegroundColor Blue
  Write-Host "    • Local Postgres       → winget install --id=PostgreSQL.PostgreSQL.16 -e" -ForegroundColor Blue
  Dim     "       then DATABASE_URL=`"postgresql://USER:PASS@localhost:5432/charclaw`""
  Write-Host ""
  Warn "Set DATABASE_URL, then re-run this script."
  exit 0
}
Good "DATABASE_URL set"

# ───── Prisma: generate + push schema ─────────────────────────────────────
Step "🗃  Applying Prisma schema…"
Push-Location packages/web
try {
  & npx prisma generate --schema prisma/schema.prisma | Out-Null
  & npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate
  if ($LASTEXITCODE -ne 0) { Fail "Prisma push failed" }
} finally {
  Pop-Location
}
Good "Database schema applied"

# ───── Done ───────────────────────────────────────────────────────────────
Write-Host ""
Good "Setup complete."
Write-Host ""
Write-Host "  Start dev (web + daemon together):"
Write-Host "    npm run dev" -ForegroundColor Blue
Write-Host ""
Write-Host "  Then open:"
Write-Host "    http://localhost:3000/setup" -ForegroundColor Blue -NoNewline; Write-Host "   → guided onboarding"
Write-Host "    http://localhost:3000" -ForegroundColor Blue -NoNewline; Write-Host "         → the app"
Write-Host ""
Dim "  Register an OAuth app separately for real GitHub login:"
Dim "    https://github.com/settings/applications/new"
Dim "    Callback: http://localhost:3000/api/auth/callback/github"
Dim "  Or leave GITHUB_PAT in $EnvFile to use the dev-mode auth bypass."
Write-Host ""
