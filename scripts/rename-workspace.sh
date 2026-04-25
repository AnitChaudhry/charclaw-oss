#!/usr/bin/env bash
# Rename the local workspace folder from upfyn-stream-agents → charclaw.
#
# RUN THIS ONLY AFTER:
#   - closing every tool that has the old folder open (Claude, VS Code, dev
#     server, running daemon, any shell currently CWD'd inside it)
#   - committing + pushing any pending work
#
# Usage (from a shell NOT currently inside upfyn-stream-agents):
#   bash scripts/rename-workspace.sh

set -euo pipefail

# Resolve script's absolute path and walk up to find the repo parent
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$REPO_DIR/.." && pwd)"
CURRENT_NAME="$(basename "$REPO_DIR")"

if [[ "$CURRENT_NAME" != "upfyn-stream-agents" ]]; then
  echo "Nothing to do: current folder is '$CURRENT_NAME', not 'upfyn-stream-agents'."
  exit 0
fi

TARGET="$PARENT_DIR/charclaw"
if [[ -e "$TARGET" ]]; then
  echo "Target already exists: $TARGET" >&2
  echo "Refusing to overwrite. Remove or rename the target first." >&2
  exit 1
fi

# Make sure we're not CWD inside the folder being renamed (Windows will fail)
if [[ "$PWD" == "$REPO_DIR"* ]]; then
  echo "You are CWD inside the folder being renamed. Exit to a parent shell first." >&2
  exit 1
fi

echo "Renaming:"
echo "  from: $REPO_DIR"
echo "  to:   $TARGET"
mv "$REPO_DIR" "$TARGET"
echo "✓ Renamed. Reopen your tools pointing at the new path."
