#!/usr/bin/env bash
# Sync canonical staging search fixture to consumer packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/shared/fixtures/activity_search_staging.json"

if [[ ! -f "${SRC}" ]]; then
  echo "Missing fixture: ${SRC}" >&2
  echo "Run: python3 scripts/codegen/generate_activity_search_staging.py" >&2
  exit 1
fi

DESTS=(
  "${ROOT}/backend/fixtures/activity_search_staging.json"
  "${ROOT}/apps/public_www/src/data/activity_search_staging.json"
  "${ROOT}/apps/siutindei_app/assets/fixtures/activity_search_staging.json"
)

for dest in "${DESTS[@]}"; do
  mkdir -p "$(dirname "${dest}")"
  cp "${SRC}" "${dest}"
  echo "Synced -> ${dest}"
done
