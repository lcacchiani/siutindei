# Public Website (`apps/public_www`)

This document describes the design, hosting topology, security model, and
deployment lifecycle of the Siu Tin Dei marketing/public website.

## Goals

1. Serve a fast, statically-rendered marketing site to anonymous users.
2. Provide an isolated **staging** environment that mirrors production
   exactly so we can validate releases before promoting them.
3. Make production promotion **rebuild-or-copy**: either rebuild with
   production env vars (default) or perform an S3-only artifact copy from
   the staging bucket (cheaper, faster, byte-for-byte identical artifact).
4. Default-deny indexing on staging so search engines never see a draft.

## Hosting topology

One CloudFormation stack — `lxsoftware-siutindei-public-www` — provisions
**two parallel website environments** (production + staging). Each
environment has:

| Resource | Notes |
|---|---|
| S3 origin bucket | `BlockPublicAccess: BLOCK_ALL`, SSL-only, versioned, retain on delete, S3-managed encryption, server access logging into the logging bucket. |
| S3 logging bucket | Same hardening, 90-day expiration lifecycle, 30-day non-current expiration. |
| CloudFront Origin Access Identity | Restricts S3 reads to the distribution. |
| CloudFront Distribution | TLS 1.2 (2021), HTTP/2 + HTTP/3, CloudFront access logs into the logging bucket, `defaultRootObject=index.html`, custom 4xx → `/404.html`. |
| CloudFront Function (`pathRewriteFunction`) | Maps `/foo/` and `/foo` → `/foo/index.html` for Next.js `output: 'export'`. |
| Response Headers Policy | HSTS (`max-age=31536000; includeSubDomains; preload`), CSP (`base-uri 'self'; object-src 'none'; frame-ancestors 'none'`), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options`, `XSS-Protection`, restrictive `Permissions-Policy`, and `X-Robots-Tag: noindex,nofollow,noarchive` on **staging only**. |
| WAF (optional) | Reuses the admin web WebACL ARN from `params/production.json`. Attached via `CfnCondition` so the stack can deploy to lower environments before the WAF is created. |

CDK source: [`backend/infrastructure/lib/public-www-stack.ts`](../../backend/infrastructure/lib/public-www-stack.ts).
Stack registration: [`backend/infrastructure/bin/app.ts`](../../backend/infrastructure/bin/app.ts).

### Custom domains

Configured via `backend/infrastructure/params/production.json` and passed to
CloudFront as alternate domain names (CNAMEs). Both environments reuse the
same us-east-1 ACM certificate as the admin web; hostnames must be listed on
that certificate.

| Environment | CloudFront alias |
|---|---|
| Production | `siutindei-www.lx-software.com` |
| Staging | `siutindei-www-staging.lx-software.com` |

### Resource naming

Both environments respect the 63-char S3 bucket name limit:

| Logical id | Physical name pattern | Length math (`ap-southeast-1`) |
|---|---|---|
| `PublicWwwBucket` | `lxsoftware-siutindei-www-{account12}-{region}` | 24+1+12+1+14 = 52 ≤ 63 |
| `PublicWwwLoggingBucket` | `lxsoftware-siutindei-www-logs-{account12}-{region}` | 29+1+12+1+14 = 57 ≤ 63 |
| `PublicWwwStagingBucket` | `lxsoftware-siutindei-stg-www-{account12}-{region}` | 28+1+12+1+14 = 56 ≤ 63 |
| `PublicWwwStagingLoggingBucket` | `lxsoftware-siutindei-stg-www-logs-{account12}-{region}` | 33+1+12+1+14 = 61 ≤ 63 |

Note the staging prefix uses `stg` (not `staging`) to leave headroom.

## Application

Source: [`apps/public_www`](../../apps/public_www).

- Next.js (App Router) with `output: 'export'`.
- TypeScript only.
- Tailwind CSS v4 via `@tailwindcss/postcss`.
- Vitest + Testing Library for unit/component tests.
- Lighthouse CI configured at `apps/public_www/.lighthouserc.json`.
- Build script: `next build` → `inject-csp-meta.mjs` → `validate-csp-meta.mjs`.

The build is deliberately **gated** by:

| Script | Purpose |
|---|---|
| `assert-build-env-contract.mjs` | Build refuses to run if `NEXT_PUBLIC_SITE_ORIGIN` or `NEXT_PUBLIC_SITE_NAME` is missing. |
| `audit-assets.mjs` | Flags oversized or executable assets in `public/`. |
| `audit:deps:prod` | `npm audit --omit=dev --audit-level=high`. |
| `inject-csp-meta.mjs` | Adds a CSP `<meta http-equiv>` defense-in-depth tag to every exported HTML. |
| `validate-csp-meta.mjs` | Fails the build if any HTML in `out/` is missing the marker. |

## Deployment lifecycle

```
push to main (apps/public_www/**)
        |
        v
deploy-public-www.yml  ── npm ci → assert env → audit → build (with SHA as release id) ──> staging
        |                                                                                     │
        |                                                                                     │
        |                                                            staging bucket
        |                                                            ├── *.html, _next/static/*, …
        |                                                            └── releases/<sha>/<full export>
        |                                                            └── releases/latest-release-id.txt
        |
        v
workflow_dispatch (Promote Public Website Release)
        ├── promotion_mode=latest_staging  → reads marker, S3-copy + invalidate (default)
        ├── promotion_mode=release_id      → operator supplies sha, fresh prod build then deploy
        └── promotion_mode=maintenance_on  → upload apps/public_www/maintenance/ to production
```

### Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| [`deploy-backend.yml`](../../.github/workflows/deploy-backend.yml) | `workflow_dispatch` (`public website` or `all stacks`), `push: backend/**` | CDK deploy of `lxsoftware-siutindei-public-www` (S3 + CloudFront for production and staging). |
| [`deploy-public-www.yml`](../../.github/workflows/deploy-public-www.yml) | `push: main`, `workflow_dispatch`, `repository_dispatch: deploy-public-www` | Build + sync to staging bucket, write release marker. |
| [`promote-public-www.yml`](../../.github/workflows/promote-public-www.yml) | `workflow_dispatch` | Promote a staging release to production or flip production into maintenance mode. |
| [`smoke-public-www-staging.yml`](../../.github/workflows/smoke-public-www-staging.yml) | `workflow_dispatch` | Crawl staging sitemap and assert every page responds 2xx/3xx. |
| [`lighthouse-public-www.yml`](../../.github/workflows/lighthouse-public-www.yml) | `workflow_dispatch` | Run Lighthouse CI on the production build. |

### Promotion script

The deploy script lives at
[`scripts/deploy/deploy-public-www.sh`](../../scripts/deploy/deploy-public-www.sh)
and is invoked by both workflows. It supports three primary modes:

1. **Standard deploy**: `PUBLIC_WWW_ENVIRONMENT=staging|production` syncs
   `apps/public_www/out` to the bucket, writes a release marker, and
   invalidates CloudFront.
2. **Promotion**: when `PUBLIC_WWW_PROMOTE_RELEASE_ID` is set:
   - if `PUBLIC_WWW_PROMOTION_BUILD_DIR` is also set, the local build (with
     production env vars) is uploaded to production;
   - otherwise the script does an S3-side `aws s3 sync` from
     `s3://staging/releases/<id>/` to `s3://production/`.
3. **Maintenance mode**: `PUBLIC_WWW_MAINTENANCE_MODE=true` uploads
   `apps/public_www/maintenance/` to the target bucket with `Cache-Control:
   no-store`, after substituting `__NEXT_PUBLIC_EMAIL__`,
   `__NEXT_PUBLIC_WHATSAPP_URL__`, `__NEXT_PUBLIC_INSTAGRAM_URL__` placeholders.

The script also enforces `robots.txt: User-agent: *\nDisallow: /` whenever
the target environment is `staging`.

## Security headers and CSP

The CloudFront response headers policy applies in front of every viewer
response. The HTML produced by `next build` *also* carries an inline CSP
`<meta http-equiv>` tag (`scripts/inject-csp-meta.mjs`) so that CSP applies
even when an HTML file is rendered outside CloudFront (local QA, opened
from disk, archived snapshot).

Both CSPs are aligned to the same baseline:

```
default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
script-src 'self'; font-src 'self' data:; connect-src 'self';
base-uri 'self'; object-src 'none'; frame-ancestors 'none';
```

`'unsafe-inline'` is allowed for `style-src` to keep critical-CSS friendly;
inline scripts and inline event handlers are not allowed and are blocked
both at CSP layer and via the `.cursorrules` "no `dangerouslySetInnerHTML`,
no `eval`" rule.

## Future work — `/www/*` API proxy

When the public website needs to call the backend API, port the
`/www/*` CloudFront behavior pattern from
`lcacchiani/evolvesprouts/backend/infrastructure/lib/public-www-stack.ts`:

- A `wwwProxyAllowlistFunction` CloudFront Function runs at
  `viewer-request` and rejects any path/method pair that isn't in the
  allow-list.
- The behavior forwards to an `HttpOrigin` pointing at the API Gateway
  custom domain (already provisioned at
  `siutindei-api.lx-software.com`).
- Add the dependency chain across all CloudFront Functions in an
  environment (see comment in `evolvesprouts/public-www-stack.ts`) to
  serialize updates within the regional rate limit.
- Mirror the maintenance-mode swap in `deploy-public-www.sh`
  (`apply_www_proxy_mode`).
- Update the smoke-test workflow to include the `--api-only` and `--all`
  scopes (the current scaffolding only covers pages).
