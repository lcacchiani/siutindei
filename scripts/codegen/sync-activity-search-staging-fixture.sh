#!/usr/bin/env bash
# Copy canonical staging search fixture to build-time consumer paths.
# Usage: sync-activity-search-staging-fixture.sh [all|backend|public-www]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/shared/fixtures/activity_search_staging.json"
TARGET="${1:-all}"

if [[ ! -f "${SRC}" ]]; then
  echo "Missing fixture: ${SRC}" >&2
  echo "Run: python3 scripts/codegen/generate_activity_search_staging.py" >&2
  exit 1
fi

sync_backend() {
  local dest="${ROOT}/backend/fixtures/activity_search_staging.json"
  mkdir -p "$(dirname "${dest}")"
  cp "${SRC}" "${dest}"
  echo "Synced -> ${dest}"
}

sync_public_www() {
  local dest="${ROOT}/apps/public_www/public/fixtures/activity_search_staging.json"
  mkdir -p "$(dirname "${dest}")"
  cp "${SRC}" "${dest}"
  echo "Synced -> ${dest}"
}

case "${TARGET}" in
  all)
    sync_backend
    sync_public_www
    ;;
  backend)
    sync_backend
    ;;
  public-www)
    sync_public_www
    ;;
  *)
    echo "Unknown target: ${TARGET} (use all, backend, or public-www)" >&2
    exit 1
    ;;
esac
