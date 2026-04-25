#!/usr/bin/env bash
# CharClaw — one-command local setup for macOS / Linux / Windows (Git Bash)
# Usage from repo root:   bash scripts/setup.sh
#
# Idempotent. Safe to re-run. Creates packages/web/.env if missing,
# generates secrets, pushes Prisma schema, registers the local daemon
# (optional), and prints the exact start command.
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo "🐍 CharClaw Setup"
echo "==============="
echo ""

# ───── Detect OS ──────────────────────────────────────────────────────────
OS="$(uname -s 2>/dev/null || echo Unknown)"
case "$OS" in
  Darwin*)   OS_NAME="macOS" ;;
  Linux*)    OS_NAME="Linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS_NAME="Windows (Git Bash)" ;;
  *)         OS_NAME="$OS" ;;
esac
echo -e "${DIM}Detected OS: $OS_NAME${NC}"

# Cross-platform `sed -i` (Mac vs GNU): use a helper that writes to temp.
# Both variants support: sed_inplace <pattern> <file>
sed_inplace() {
  local pattern="$1"
  local file="$2"
  local tmp="${file}.__tmp__$$"
  sed "$pattern" "$file" > "$tmp"
  mv "$tmp" "$file"
}

# ───── Node.js ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org (v18+)${NC}"
  exit 1
fi
NODE_VER=$(node -v | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node.js v18+ required (found $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ───── Git ────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo -e "${RED}✗ Git not found. Install from https://git-scm.com${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Git $(git --version | awk '{print $3}')${NC}"

# ───── Dependencies ───────────────────────────────────────────────────────
echo ""
echo "📦 Installing dependencies…"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ───── Env file (at packages/web/.env — where Next.js reads it) ───────────
ENV_FILE="packages/web/.env"
ENV_EXAMPLE=".env.example"

if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo -e "${YELLOW}⚠ No $ENV_FILE — seeding from $ENV_EXAMPLE${NC}"
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  # Generate secrets (Node-based — no OpenSSL dependency)
  NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  AUTOPILOT_CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

  sed_inplace "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" "$ENV_FILE"
  sed_inplace "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"|" "$ENV_FILE"
  sed_inplace "s|AUTOPILOT_CRON_SECRET=.*|AUTOPILOT_CRON_SECRET=\"$AUTOPILOT_CRON_SECRET\"|" "$ENV_FILE"
  echo -e "${GREEN}✓ Generated NEXTAUTH_SECRET, ENCRYPTION_KEY, AUTOPILOT_CRON_SECRET${NC}"
  echo -e "${DIM}  Back these up — losing ENCRYPTION_KEY bricks every user's stored API keys.${NC}"
else
  echo -e "${GREEN}✓ $ENV_FILE already exists — keeping your values${NC}"
fi

# ───── Database check ─────────────────────────────────────────────────────
DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//')
if [[ -z "$DB_URL" ]] || [[ "$DB_URL" == *"REPLACE_ME"* ]] || [[ "$DB_URL" == *"user:password@host"* ]]; then
  echo ""
  echo -e "${YELLOW}⚠ DATABASE_URL not set in $ENV_FILE${NC}"
  echo ""
  echo "  Pick one and paste its connection string into $ENV_FILE:"
  echo -e "    ${BLUE}• Neon (free, hosted)${NC}   → https://neon.tech/signup"
  echo -e "    ${BLUE}• Supabase (free)${NC}       → https://supabase.com"
  echo -e "    ${BLUE}• Local Postgres${NC}         →"
  case "$OS_NAME" in
    macOS)               echo "       brew install postgresql@16 && brew services start postgresql@16" ;;
    Linux)               echo "       sudo apt-get install postgresql-16 && sudo systemctl start postgresql" ;;
    "Windows (Git Bash)") echo "       winget install --id=PostgreSQL.PostgreSQL.16 -e --accept-source-agreements" ;;
    *)                   echo "       install Postgres 16+ for your OS" ;;
  esac
  echo -e "       ${DIM}then DATABASE_URL=\"postgresql://USER:PASS@localhost:5432/charclaw\"${NC}"
  echo ""
  echo -e "${YELLOW}  Set DATABASE_URL, then re-run this script.${NC}"
  exit 0
fi
echo -e "${GREEN}✓ DATABASE_URL set${NC}"

# ───── Prisma: generate + push schema ─────────────────────────────────────
echo ""
echo "🗃  Applying Prisma schema…"
( cd packages/web && npx prisma generate --schema prisma/schema.prisma 1>/dev/null )
( cd packages/web && npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate )
echo -e "${GREEN}✓ Database schema applied${NC}"

# ───── Done ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✅ Setup complete.${NC}"
echo ""
echo "  Start dev (web + daemon together):"
echo -e "    ${BLUE}npm run dev${NC}"
echo ""
echo "  Then open:"
echo -e "    ${BLUE}http://localhost:3000/setup${NC}   → guided onboarding"
echo -e "    ${BLUE}http://localhost:3000${NC}         → the app"
echo ""
echo -e "${DIM}  Register an OAuth app separately if you want real GitHub login:${NC}"
echo -e "${DIM}    https://github.com/settings/applications/new${NC}"
echo -e "${DIM}    Callback: http://localhost:3000/api/auth/callback/github${NC}"
echo -e "${DIM}  Or leave GITHUB_PAT in $ENV_FILE to use the dev-mode auth bypass.${NC}"
echo ""
