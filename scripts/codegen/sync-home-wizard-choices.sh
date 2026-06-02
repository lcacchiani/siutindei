#!/usr/bin/env bash
# Copy canonical home wizard choices into apps/public_www for TypeScript bundling.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CANONICAL="${ROOT}/shared/home_wizard/home_wizard_choices.json"
TARGET="${ROOT}/apps/public_www/src/data/home_wizard_choices.json"

if [ ! -f "$CANONICAL" ]; then
  echo "sync-home-wizard-choices: missing canonical file at $CANONICAL"
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  if ! diff -q "$CANONICAL" "$TARGET" >/dev/null 2>&1; then
    echo "home_wizard_choices.json is out of sync with shared/home_wizard/"
    echo "Run: bash scripts/codegen/sync-home-wizard-choices.sh"
    exit 1
  fi
  echo "home_wizard_choices.json is in sync."
  exit 0
fi

cp "$CANONICAL" "$TARGET"
echo "Synced home wizard choices to apps/public_www/src/data/"
