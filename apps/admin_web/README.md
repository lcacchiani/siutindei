# Admin Web (SPA)

Vite + React Router + TanStack Query + Bootstrap 5 admin portal for
managing organizations, locations, activities, pricing, and schedules.

## Configuration

Create a `.env.local` with:

```
VITE_API_BASE_URL=
VITE_COGNITO_DOMAIN=
VITE_COGNITO_CLIENT_ID=
```

Values:
- `VITE_API_BASE_URL`: API Gateway base URL (ends with `/prod`).
- `VITE_COGNITO_DOMAIN`: Cognito hosted UI domain (full URL or domain).
- `VITE_COGNITO_CLIENT_ID`: User pool app client ID.

The app also accepts `NEXT_PUBLIC_*` as a fallback for CI compatibility.

## Development

```
npm install
npm run dev
```

## Build (static)

```
npm run build
```

The static output is generated in `dist/`.
