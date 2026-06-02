# OpenAPI code generation (generalized)

This folder contains generic scripts for generating API clients from any
OpenAPI spec.

## Current client generation in this repo

- **Admin web** uses `openapi-typescript` against `docs/api/admin.yaml` and
  `docs/api/search.yaml` (see `apps/admin_web/package.json#generate:api`).
  Generated types live in `apps/admin_web/src/types/*.generated.ts` and must
  be committed when the OpenAPI specs change.
- **Public website** and **Flutter** hand-write their search clients against
  `docs/api/search.yaml`; keep them aligned when the API surface changes.
- The historical `packages/api_client_ts` / `packages/api_client_dart`
  paths are not present in this repository. Use the admin_web workflow above
  for TypeScript types, or run `openapi_codegen.sh` into a new package if you
  introduce shared clients later.

## Usage

1. Install Node.js (18+ recommended).
2. Run the codegen script with the desired generator.

Example:

```
./scripts/codegen/openapi_codegen.sh \
  --spec docs/api/search.yaml \
  --generator typescript-fetch \
  --output packages/api_client_ts
```

You can use any generator supported by OpenAPI Generator.
