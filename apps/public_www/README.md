# Siu Tin Dei — Public Website (`apps/public_www`)

The marketing site for **Siu Tin Dei**, built as a Next.js static export and
hosted on CloudFront + S3.

This directory contains the application code. The hosting infrastructure and
the deployment workflow are owned by:

- `backend/infrastructure/lib/public-www-stack.ts` (CDK)
- `scripts/deploy/deploy-public-www.sh`
- `.github/workflows/deploy-public-www.yml` (push-to-main → staging)
- `.github/workflows/promote-public-www.yml` (manual → production)
- `.github/workflows/smoke-public-www-staging.yml`
- `.github/workflows/lighthouse-public-www.yml`

See [`docs/architecture/public-www.md`](../../docs/architecture/public-www.md)
for the full design.

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The dev server runs at <http://localhost:3000>.

## Static export build

```bash
npm run build
```

This runs `next build` (which produces `out/` because `next.config.ts` sets
`output: 'export'`), then injects a CSP `<meta http-equiv>` into every
generated HTML and validates it.

## Deployment model

There is **one CloudFormation stack** (`lxsoftware-siutindei-public-www`) with
**two CloudFront distributions** in it: one for production
(`siutindei-www.lx-software.com`) and one for staging
(`siutindei-www-staging.lx-software.com`).

| Trigger | Action |
|---|---|
| Push to `main` touching `apps/public_www/**` or `scripts/**` | Build + deploy to **staging**, write a release marker `releases/<sha>/` to the staging bucket. |
| `workflow_dispatch` of `Promote Public Website Release` | Promote a release id (default: latest staging marker) **or** flip production into maintenance mode. |
| `workflow_dispatch` of `Smoke Public Website Staging` | Crawl staging sitemap and check every page returns 2xx/3xx. |
| `workflow_dispatch` of `Lighthouse Public Website` | Run Lighthouse CI against the production build. |

A promotion is either a fresh build with production env vars or an S3-only
artifact copy (`releases/<id>/` → root of production bucket) followed by a
CloudFront invalidation.

## Required environment variables (build time)

The build refuses to run if any of these are missing
(`scripts/assert-build-env-contract.mjs`):

- `NEXT_PUBLIC_SITE_ORIGIN`
- `NEXT_PUBLIC_SITE_NAME`

CI workflows resolve defaults from `backend/infrastructure/params/production.json`
via `scripts/deploy/resolve-public-www-build-env.sh`. GitHub Environment
variables (`NEXT_PUBLIC_*`) override those defaults when set.

Optional `NEXT_PUBLIC_*` variables documented in `.env.example` are read by
`src/lib/site-config.ts`.

## Conventions

- Static export only. No server actions, no API routes, no SSR.
- TypeScript only.
- No inline `<svg>` markup in components — use SVGs from `public/images/`.
- No `dangerouslySetInnerHTML`, no `eval`/`new Function`.
- All user-visible copy lives in components for now (single locale). When a
  second locale is added, follow the evolvesprouts pattern of
  `src/content/<locale>.json` + `src/app/[locale]/...`.

See the `Public Website` section in the repository root `.cursorrules` for the
authoritative checklist.
