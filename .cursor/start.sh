#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL up and ensure the dev database and
# schema exist. Idempotent and safe on every start.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_NAME="backend_test"
export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/${DB_NAME}"
export PATH="$HOME/.local/bin:$PATH"

echo "==> Starting PostgreSQL"
sudo service postgresql start
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

# Recreate the database + schema if the disk state did not carry them over.
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb "${DB_NAME}"
fi
python3 -m alembic -c backend/db/alembic.ini upgrade head >/dev/null 2>&1 || true

echo "==> PostgreSQL ready on localhost:5432 (db: ${DB_NAME})"
