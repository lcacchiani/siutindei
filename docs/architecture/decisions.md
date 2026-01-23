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

## Database schema (Aurora PostgreSQL)

**Decisions:**
- District filter uses `locations.district` only.
- Pricing is per location with `per_class`, `per_month`, or `per_sessions`.
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
- OpenAPI contracts live under `docs/api/`.
- Activities search contract: `docs/api/activities-search.yaml`.
- Search responses are cursor-paginated.
- Cursor pagination uses schedule time and type for ordering.
- Admin CRUD contract: `docs/api/admin.yaml`.
- Admin list endpoints return next_cursor for pagination.
- API client generation is handled via generalized scripts in
  `scripts/codegen/`.

## Lambda Implementation

**Decisions:**
- Lambda entrypoint lives at `backend/lambda/activity_search/handler.py`.
- Shared application code lives under `backend/src/app`.
- Python dependencies are listed in `backend/requirements.txt`.
- Database migrations and seed are executed during CDK deploy
  via a custom resource Lambda.

## Authentication

**Decisions:**
- Cognito User Pool secures API Gateway routes.
- Admin routes require membership in the `admin` group.
- Admin group is created via CDK.
- Admin group membership can be managed via `/admin/users/{username}/groups`.
- Admin bootstrap user can be created with CDK parameters.
- Authentication is passwordless: email custom challenge (OTP + optional magic
  link) and federated sign-in via Google, Apple, and Microsoft (OIDC).
- Hosted UI uses OAuth code flow with callback/logout URLs supplied via CDK
  parameters.
- API Gateway method caching enabled for search responses (5-minute TTL).

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
- Android signing templates live in `apps/customer_app/android/`.
- CI uploads IPA to TestFlight when App Store API keys are set.
- iOS signing uses Fastlane match with a private certificates repo.
- Fastlane config lives in `apps/customer_app/ios/fastlane`.
- iOS export settings are templated at
  `apps/customer_app/ios/ExportOptions.plist.template`
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

## CI/CD Variables and Secrets

**GitHub Variables**
- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `CDK_STACKS` (optional)
- `CDK_BOOTSTRAP_QUALIFIER` (optional)
- `AMPLIFY_APP_ID`
- `AMPLIFY_BRANCH`
- `ANDROID_PACKAGE_NAME`
- `ANDROID_RELEASE_TRACK`
- `IOS_BUNDLE_ID`
- `APPLE_TEAM_ID`
- `IOS_PROVISIONING_PROFILE` (optional)

**GitHub Secrets**
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

## Next Steps

1. Configure GitHub OIDC role in AWS and set org/repo variables.
2. Initialize CDK project under `backend/infrastructure`.
3. Bootstrap Next.js App Router admin app in `apps/admin_web`.
4. Configure Flutter release pipelines for AAB and iOS.
5. Configure Amplify app ID and branch variables for admin hosting.
6. Configure Android keystore and iOS match credentials.
