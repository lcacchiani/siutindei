# Architecture Decisions

This document captures the agreed architecture decisions for the
Flutter mobile app, Next.js admin console, and AWS serverless backend.

## 1) Admin Web Router

**Decision:** Use Next.js App Router (React Server Components).

**Why:**
- Modern Next.js architecture (RSC, streaming, Suspense).
- Better performance and SSR defaults.
- Improved DX (layouts, loading, error boundaries).
- Best TypeScript support and forward compatibility.

**Canonical structure:**
- `apps/admin_web/src/app/...` with route groups and nested layouts.

## 2) Infrastructure as Code

**Decision:** AWS CDK (TypeScript) + CDK Pipelines.

**Why:**
- TypeScript-first IaC aligned with the frontend stack.
- Full AWS construct coverage and strong integration.
- Programmatic abstractions (loops, conditions, helpers).
- Self-mutating pipelines with approval gates and rollbacks.

**Canonical structure:**
- `backend/infrastructure/` contains CDK app, stacks, and pipeline.
- Deploy workflows detect and reuse existing database resources and VPCs
  to avoid replacements.
- Imports use environment variables for existing resource identifiers,
  including security groups and Secrets Manager references.

## Database schema (Aurora PostgreSQL)

**Decisions:**
- District filter uses `locations.district` only.
- Pricing is per location with `per_class`, `per_sessions`, `per_hour`,
  `per_day`, or `free`.
- Languages are session-specific (stored on schedule entries).
- Times are stored in UTC.
- DB changes are versioned with Alembic.
- Lambda connections use RDS Proxy for connection pooling.
- RDS Proxy uses IAM authentication; Lambda generates IAM tokens.
- IAM DB roles `activities_app` (read) and `activities_admin` (write)
  are created via migrations and granted `rds_iam`.
- DB connections enforce TLS and use small pools tuned for Lambda.
- Migrations Lambda uses password auth directly against the cluster endpoint.

**Core tables:**
- `organizations`
- `locations`
- `activities`
- `activity_locations`
- `activity_pricing`
- `activity_schedule`

**Migrations:**
- Alembic config and migrations live in `backend/db/`.
- Seed data lives in `backend/db/seed/seed_data.sql`.

## API Contracts

**Decisions:**
- OpenAPI contracts live under `docs/api/` and are the single source
  of truth for all API endpoint details (paths, methods, parameters,
  request/response schemas, authentication requirements).
- Activities search contract: [`docs/api/search.yaml`](../api/search.yaml).
- Admin, manager, user, and health contracts: [`docs/api/admin.yaml`](../api/admin.yaml).
- Search responses are cursor-paginated (schedule time + type ordering).
- Admin and manager list endpoints return `next_cursor` for pagination.
- API client generation is handled via generalized scripts in
  `scripts/codegen/`.
- **Do not duplicate endpoint details in architecture docs.** Always
  link to the OpenAPI specs instead.

## Lambda Implementation

**Decisions:**
- Lambda entrypoint lives at `backend/lambda/search/handler.py`.
- Shared application code lives under `backend/src/app`.
- Python dependencies are listed in `backend/requirements.txt`.
- Database migrations and seed are executed during CDK deploy
  via a custom resource Lambda.
- Lambda packaging is deterministic (no bytecode) to reduce no-op deploys.

## Authentication

**Decisions:**
- Public activity search uses an API key + device attestation; admin
  routes require Cognito `admin` group; manager routes require `admin`
  or `manager` group; user routes require any valid JWT.
- Admin and manager groups are created via CDK.
- Admin bootstrap user can be created with CDK parameters.
- Authentication is passwordless: email custom challenge (OTP + optional magic
  link) and federated sign-in via Google, Apple, and Microsoft (OIDC).
- Device attestation validates JWTs against a JWKS URL configured in CDK
  parameters.
- Hosted UI uses OAuth code flow with callback/logout URLs supplied via CDK
  parameters.
- API keys are rotated every 90 days by a scheduled Lambda.
- API Gateway method caching enabled for search responses (5-minute TTL).
- See the OpenAPI specs for per-endpoint authentication requirements:
  [`docs/api/admin.yaml`](../api/admin.yaml).

## AWS / HTTP Proxy

**Decision:** Use a generic proxy Lambda outside the VPC instead of per-service
Lambdas or NAT Gateway.

**Why:**
- Cognito disables PrivateLink when ManagedLogin is configured on the User Pool,
  so a `cognito-idp` VPC endpoint cannot be used.
- A NAT Gateway is expensive (~$45/month per AZ) for occasional API calls.
- A per-service Lambda (e.g. dedicated Cognito Lambda) duplicates routing,
  auth, and business logic.

**How:**
- `AwsApiProxyFunction` runs outside the VPC and accepts two request types:
  - `type: "aws"` – executes a boto3 call (e.g. `cognito-idp:list_users`)
  - `type: "http"` – makes an outbound HTTP request to an external API
- Requests are validated against environment-variable allow-lists:
  - `ALLOWED_ACTIONS` for AWS API calls (`service:action` pairs)
  - `ALLOWED_HTTP_URLS` for HTTP requests (URL prefixes)
- In-VPC Lambdas invoke the proxy via Lambda-to-Lambda (requires a Lambda VPC
  endpoint).
- Client helpers in `backend/src/app/services/aws_proxy.py`:
  - `invoke(service, action, params)` for AWS calls
  - `http_invoke(method, url, headers, body, timeout)` for HTTP calls

**Security:**
- IAM role scoped to specific AWS actions on specific resources.
- Allow-lists prevent the proxy from being used for unintended operations.
- Only Lambdas explicitly granted `lambda:InvokeFunction` can call the proxy.

## Flutter Amplify Configuration

**Decisions:**
- Amplify config is passed via `--dart-define=AMPLIFY_CONFIG=...`.
- API name is set with `--dart-define=AMPLIFY_API_NAME=...`.

## 3) CI/CD Authentication

**Decision:** GitHub Actions OIDC + IAM role assumption.

**Why:**
- No long-lived AWS keys stored in GitHub.
- Short-lived credentials with automatic rotation.
- Fine-grained IAM permissions and auditability.

## 4) Mobile Distribution

**Decision:** Android AAB + iOS App Store Connect/TestFlight.

**Why:**
- Google Play requires AAB for production.
- App Store Connect + TestFlight for production and beta.

**Notes:**
- CI uploads AAB to Play Console when service account secrets are set.
- Android signing uses a keystore injected at build time in CI.
- Android signing templates live in `apps/siutindei_app/android/`.
- CI uploads IPA to TestFlight when App Store API keys are set.
- iOS signing uses Fastlane match with a private certificates repo.
- Fastlane config lives in `apps/siutindei_app/ios/fastlane`.
- iOS export settings are templated at
  `apps/siutindei_app/ios/ExportOptions.plist.template`
  and generated in CI.

## 5) Amplify Usage

**Decision:** Use Amplify for client SDKs and hosting where appropriate.

**Notes:**
- Amplify SDKs are used for auth/API integration on client apps.
- Infrastructure is provisioned via CDK for stronger control.
- Admin web hosting is triggered via GitHub Actions using
  `aws amplify start-job`.
- Promotions from staging to production are handled via the
  `amplify-promote` workflow.
- The `amplify-promote` workflow uses the production environment to
  support GitHub approval gates.

## 6) Lockfile Enforcement

**Decision:** Lockfiles are required and validated in CI.

**Notes:**
- Flutter: `pubspec.lock`
- Node.js: `package-lock.json`
- iOS: `Podfile.lock`
- CI workflow: `.github/workflows/check-lockfiles.yml`

## 7) Dependency Updates

**Decision:** Use Dependabot for automated dependency updates.

**Why:**
- Automatic security vulnerability alerts and patches.
- Small, frequent updates are easier to review than large version jumps.
- PR-based workflow integrates with existing CI checks.
- Low maintenance overhead once configured.

**Configuration (`.github/dependabot.yml`):**
- GitHub Actions, npm, pip, and pub ecosystems covered.
- Weekly schedule (Mondays) to reduce PR noise.
- Dependencies grouped by category (AWS CDK, Firebase, database, etc.).
- Major version updates ignored to require manual review.
- PRs labeled by ecosystem (`dependencies`, `ci`, `backend`, `mobile`, `infrastructure`).

**Dependabot commands:**
- `@dependabot merge` - Merge when CI passes.
- `@dependabot ignore this major version` - Stop updates for this major version.
- `@dependabot ignore this dependency` - Stop all updates for this dependency.

## 8) GitHub Rulesets

**Decision:** Protect `main` branch and release tags with GitHub rulesets.

**Why:**
- Prevents accidental direct pushes to production branch.
- Enforces code review before merging.
- Ensures CI checks pass before deployment.
- Protects release tags from modification or deletion.

**Branch protection for `main`:**
- Require pull request with at least 1 approval.
- Require `lint` and `test` status checks to pass.
- Require branches to be up to date before merging.
- Block force pushes and deletions.

**Tag protection:**
- Protect `v*` tags from deletion and modification.

**Verification:**
- Weekly CI workflow (`.github/workflows/verify-rulesets.yml`) validates configuration.
- See `docs/architecture/github-rulesets.md` for setup instructions.

## CI/CD Variables and Secrets

**GitHub Variables**
- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `CDK_STACKS` (optional; comma/space-separated list, e.g. `ActivitiesApiStack`)
- `CDK_BOOTSTRAP_QUALIFIER` (optional)
- `CDK_PARAM_FILE` (optional path to CDK parameter JSON)
- `AMPLIFY_APP_ID`
- `AMPLIFY_BRANCH`
- `ANDROID_PACKAGE_NAME`
- `ANDROID_RELEASE_TRACK`
- `IOS_BUNDLE_ID`
- `APPLE_TEAM_ID`
- `IOS_PROVISIONING_PROFILE` (optional)
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_ANDROID_APP_ID`
- `FIREBASE_IOS_APP_ID`
- `FIREBASE_IOS_BUNDLE_ID`
- `FIREBASE_STORAGE_BUCKET` (optional)
- `FIREBASE_APP_CHECK_DEBUG` (optional; "true" for debug providers)

**GitHub Secrets**
- `AMPLIFY_API_KEY` (mobile API key injected at build time)
- `CDK_PARAM_GOOGLE_CLIENT_SECRET`
- `CDK_PARAM_APPLE_PRIVATE_KEY`
- `CDK_PARAM_MICROSOFT_CLIENT_SECRET`
- `CDK_PARAM_PUBLIC_API_KEY_VALUE`
- `CDK_PARAM_ADMIN_BOOTSTRAP_TEMP_PASSWORD` (optional)
- `APPSTORE_API_KEY_JSON` (recommended single JSON secret with issuer_id,
  key_id, private_key)
- `GOOGLE_PLAY_SERVICE_ACCOUNT`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `APPSTORE_API_KEY_JSON`
- `APPSTORE_ISSUER_ID`
- `APPSTORE_API_KEY_ID`
- `APPSTORE_API_PRIVATE_KEY`
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `FASTLANE_USER`
- `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`

**CDK Parameters (via `CDK_PARAM_FILE`)**
- `PublicApiKeyValue` (API key required for public search)
- `DeviceAttestationJwksUrl`, `DeviceAttestationIssuer`, `DeviceAttestationAudience`

## Keeping Documentation Up to Date

**Decision:** Architecture documentation in `docs/architecture/` describes
high-level design, patterns, and decisions. API endpoint details (paths,
methods, parameters, schemas) are documented exclusively in the OpenAPI
specs under `docs/api/`. Architecture docs must link to the OpenAPI specs
rather than duplicating endpoint information.

When making changes:
1. Update the relevant OpenAPI spec if adding/changing endpoints.
2. Update `docs/architecture/lambdas.md` if adding/changing Lambda functions.
3. Update `docs/architecture/database-schema.md` if adding/changing tables.
4. Update other architecture docs if design decisions or patterns change.
