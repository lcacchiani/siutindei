# Architecture Overview

This document describes the current architecture for the mobile app,
admin console, and backend services.

## High-level diagram

```
Flutter Mobile / Next.js Admin
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

### Admin console (Next.js App Router)
- Admin users manage organizations, activities, schedules, and pricing.
- Hosted on Amplify Hosting (release jobs triggered in CI).

### Backend
- API Gateway exposes REST endpoints (start with `GET /activities/search`).
- Lambda functions in `backend/lambda/` call into shared code in
  `backend/src/app`.
- SQLAlchemy models map to Aurora PostgreSQL.
- Alembic manages schema migrations, executed via a custom resource Lambda
  during deploy.

## Data model

Key entities:
- `organizations`
- `locations` (district used for filtering)
- `activities`
- `activity_locations`
- `activity_pricing` (per-class, per-month, per-sessions)
- `activity_schedule` (weekly, monthly, date-specific; languages per session)

All times are stored in UTC.

## Database and migrations

- Aurora PostgreSQL Serverless v2.
- RDS Proxy with IAM auth for Lambda connections.
- Alembic migrations live under `backend/db/`.
- Seed data stored in `backend/db/seed/seed_data.sql`.

## CI/CD

- GitHub Actions with OIDC for AWS access.
- Deploy workflows for mobile, admin, backend, iOS.
- CDK bootstrap workflow for initial environment setup.
- Lockfile checks for Flutter, Node, and iOS.
- Amplify promotion workflow with gating (staging -> main).

## Security

- No long-lived AWS credentials in GitHub.
- IAM auth for RDS Proxy, TLS enforced on DB connections.
- Secrets stored in GitHub Secrets or AWS Secrets Manager.

## Observability (planned)

- CloudWatch logs for Lambda.
- X-Ray for tracing.
- (Optional) Sentry for client + server error reporting.

## Caching (planned)

- API-level caching for popular search queries.
- Client-side caching with stale-while-revalidate in Flutter.

## Next steps

1. Wire API Gateway responses to pagination cursor logic.
2. Implement admin CRUD APIs.
3. Add search caching layer (Redis or API caching).
