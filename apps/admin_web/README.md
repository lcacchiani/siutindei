# Admin Web (SPA)

Single-page admin portal for managing organizations, locations, activities,
pricing, and schedules.

## Configuration

Create a `.env.local` with:

```
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_COGNITO_DOMAIN=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_SCHEDULE_DEFAULT_DURATION_MINUTES=60
```

Values:
- `NEXT_PUBLIC_API_BASE_URL`: API Gateway base URL (ends with `/prod`).
- `NEXT_PUBLIC_COGNITO_DOMAIN`: Cognito hosted UI domain (full URL or domain).
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`: User pool app client ID.
- `NEXT_PUBLIC_SCHEDULE_DEFAULT_DURATION_MINUTES`: default schedule duration
  in minutes (used to auto-set end time).

## Development

```
npm install
npm run dev
```

## Build (static)

```
npm run build
```

The static output is generated in `out/`.
