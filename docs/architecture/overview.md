# Architecture Overview

This document describes the current architecture for the mobile app,
admin console, and backend services.

## High-level diagram

```
Flutter Mobile / Next.js Admin
        |
        v
    Cognito (Auth)
        |
        v
    API Gateway
        |
        v
      Lambda (Python)
        |
        v
     RDS Proxy
        |
        v
 Aurora PostgreSQL (Serverless v2)
```

## Components

### Mobile app (Flutter)
- Users browse activities and filter by age, district, price, time/day,
  and language.
- Uses generated Dart API client from OpenAPI specs.
- Device attestation uses Firebase App Check (Play Integrity / App Attest).

### Admin console (Next.js App Router)
- Admin users manage organizations, activities, schedules, and pricing.
- Hosted on Amplify Hosting (release jobs triggered in CI).

### Backend
- API Gateway exposes REST endpoints for public search, admin CRUD,
  manager CRUD, and user self-service operations.
- For the full list of API routes, request/response schemas, and
  authentication requirements, see the OpenAPI specs:
  - [`docs/api/search.yaml`](../api/search.yaml) — public activity search
  - [`docs/api/admin.yaml`](../api/admin.yaml) — admin, manager, user, and health endpoints
- Lambda functions in `backend/lambda/` call into shared code in
  `backend/src/app`.
- See [`docs/architecture/lambdas.md`](lambdas.md) for a full function inventory.
- A generic AWS/HTTP proxy Lambda (`AwsApiProxyFunction`) runs outside
  the VPC and provides a channel for in-VPC Lambdas to call services
  that are unreachable via PrivateLink (e.g. Cognito with ManagedLogin).
  Requests are gated by allow-lists (`ALLOWED_ACTIONS` for AWS API
  calls, `ALLOWED_HTTP_URLS` for outbound HTTP).  See
  `backend/src/app/services/aws_proxy.py`.
- Asynchronous messaging (SNS + SQS) is used for manager access requests
  and organization suggestions. See [`docs/architecture/aws-messaging.md`](aws-messaging.md).
- SQLAlchemy models map to Aurora PostgreSQL.
- Alembic manages schema migrations, executed via a custom resource Lambda
  during deploy.
- Cognito User Pool secures admin/manager routes; any-user routes require
  only a valid JWT. Passwordless email challenges and federated sign-in
  (Google, Apple, Microsoft) are supported.
- API keys are rotated automatically every 90 days via a scheduled Lambda.

## Data model

Key entities:
- `organizations` (with manager assignment)
- `locations` (district used for filtering)
- `activities`
- `activity_locations`
- `activity_pricing` (per-class, per-month, per-sessions)
- `activity_schedule` (weekly only; languages per schedule)
- `activity_schedule_entries` (per-day timeslots for schedules)
- `organization_access_requests` (manager access workflow)
- `organization_suggestions` (user-submitted place suggestions)
- `audit_log` (automatic change tracking via triggers)

All times are stored in UTC.
See [`docs/architecture/database-schema.md`](database-schema.md) for full table details.

## Database and migrations

- Aurora PostgreSQL Serverless v2.
- RDS Proxy with IAM auth for Lambda connections.
- Alembic migrations live under `backend/db/`.
- Seed data stored in `backend/db/seed/seed_data.sql`.
- Migrations run via a custom resource Lambda using password auth.
- Application traffic uses IAM auth via the proxy and the `activities_app` role.
- Deployments reuse existing DB clusters, proxies, and VPCs when detected.

## CI/CD

- GitHub Actions with OIDC for AWS access.
- Deploy workflows for mobile, admin, backend, iOS.
- CDK bootstrap workflow for initial environment setup.
- Lockfile checks for Flutter, Node, and iOS.
- Amplify promotion workflow with gating (staging -> main).
- Dependabot enabled for automated dependency updates (see below).
- Infrastructure tests validate CDK templates for new and imported
  database resources.

## Dependency Management

Dependabot is configured (`.github/dependabot.yml`) to automatically create
pull requests for dependency updates:

| Ecosystem | Directory | Scope |
|-----------|-----------|-------|
| GitHub Actions | `/` | CI workflow action versions |
| npm | `/backend/infrastructure` | CDK and TypeScript dependencies |
| pip | `/backend` | Python Lambda dependencies |
| pub | `/apps/siutindei_app` | Flutter/Dart dependencies |

**Configuration:**
- Weekly updates (Mondays) to reduce PR noise.
- Related dependencies grouped into single PRs (AWS, Firebase, database, etc.).
- Major version updates ignored (require manual review).
- PRs labeled by ecosystem for easy filtering.

## Security

- No long-lived AWS credentials in GitHub.
- IAM auth for RDS Proxy, TLS enforced on DB connections.
- Secrets stored in GitHub Secrets or AWS Secrets Manager.
- Public activity search requires an API key plus device attestation (JWKS-validated).
- Admin routes require membership in the Cognito `admin` group.
- Manager routes require `admin` or `manager` group membership.
- User routes require any valid Cognito JWT (no group requirement).
- API keys are rotated every 90 days via a scheduled Lambda.
- Optional CDK parameters can bootstrap an initial admin user.
- Passwordless email sign-in uses Cognito custom auth triggers.
- Hosted UI enables Google, Apple, and Microsoft IdPs via OAuth.
- Database audit logging tracks all data changes (see [`audit-logging.md`](audit-logging.md)).
- See [`docs/architecture/security.md`](security.md) for full security guidelines.

## Observability

- CloudWatch logs for all Lambda functions (KMS encrypted, 90-day retention).
- X-Ray tracing enabled for API Gateway.
- CloudWatch alarms for DLQ messages (manager request processing failures).
- Structured JSON logging with request ID correlation.

## Caching

- API Gateway method caching enabled for search queries (5-minute TTL).
- Cache keys include all search query parameters.
- Client-side caching with stale-while-revalidate in Flutter (planned).
- See [`docs/architecture/cloudflare-optimization.md`](cloudflare-optimization.md) for edge caching strategy.
