# Agents

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | Runtime | Purpose |
|---------|-----------|---------|---------|
| Python backend | `backend/` | Python 3.12 | Lambda handlers, DB migrations, tests |
| Admin web | `apps/admin_web/` | Node.js 24 (npm) | Next.js admin SPA |
| CDK infrastructure | `backend/infrastructure/` | Node.js 24 (npm) | AWS CDK IaC |
| Flutter app | `apps/siutindei_app/` | Flutter stable | Mobile app (not set up in cloud) |

### Running services

- **Admin web dev server**: `cd apps/admin_web && npm run dev` (port 3000)
- **PostgreSQL**: `service postgresql start` then connect at `postgresql+psycopg://postgres:postgres@localhost:5432/backend_test`

### Lint / Test / Build commands

See `package.json` scripts and `.github/workflows/lint.yml` / `test.yml` for canonical commands. Key shortcuts:

- **Python lint**: `ruff check backend/` and `ruff format --check backend/`
- **Python tests**: `PYTHONPATH=backend/src DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/backend_test python3 -m pytest tests backend`
- **Admin web lint**: `cd apps/admin_web && npm run lint`
- **Admin web typecheck**: `cd apps/admin_web && npm run typecheck`
- **Admin web E2E**: `cd apps/admin_web && npx playwright test` (requires Chromium; dev server must be running on port 3000)
- **CDK build**: `cd backend/infrastructure && npm run build`
- **Pre-commit (all)**: `pre-commit run --all-files`

### Non-obvious caveats

- The system Python has debian-managed packages (PyJWT, etc.) that conflict with pip. Use `pip install --ignore-installed` when installing backend deps to avoid "Cannot uninstall" errors.
- Alembic migrations require `DATABASE_URL` env var. Run from workspace root: `python3 -m alembic -c backend/db/alembic.ini upgrade head`.
- Node.js is installed via nvm at `/home/ubuntu/.nvm`. Source it before using node/npm: `export NVM_DIR="/home/ubuntu/.nvm" && . "$NVM_DIR/nvm.sh"`.
- PostgreSQL pg_hba.conf must be set to `md5` auth (not `peer`) for password-based connections. After install, run: `sed -i 's/local\s*all\s*all\s*peer/local all all md5/' /etc/postgresql/16/main/pg_hba.conf && service postgresql restart`.
- E2E tests for login/auth-related flows require Cognito env vars. Tests that don't need real auth sessions pass; authenticated flow tests fail without a real Cognito pool. The test fixtures mock auth via `test-fixtures.ts`.
- The admin web `.env.local` needs `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_COGNITO_DOMAIN`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID` for full functionality. The dev server starts without them (shows config warnings).
- Python formatting rule: run `pre-commit run ruff-format --all-files` before any Python commit (per `.cursorrules`).
