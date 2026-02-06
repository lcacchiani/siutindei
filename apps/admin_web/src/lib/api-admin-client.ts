/**
 * Type-safe admin API client backed by openapi-fetch.
 *
 * Types are auto-generated from docs/api/admin.yaml via:
 *   npm run generate:api
 *
 * Usage:
 *   import { getAdminApi } from '@/lib/api-admin-client';
 *   import type { AdminSchemas } from '@/lib/api-admin-client';
 *
 *   const api = getAdminApi();
 *
 *   // All paths, methods, params, and responses are type-checked at compile time.
 *   const { data, error } = await api.GET('/v1/admin/organizations', {
 *     params: { query: { limit: 20 } },
 *   });
 *
 *   // Access schema types directly:
 *   type Org = AdminSchemas['Organization'];
 */

import createClient, { type Middleware } from 'openapi-fetch';
import type { paths, components } from '../types/api-admin.generated';
import { ensureFreshTokens } from './auth';
import { getApiBaseUrl } from './config';

// ---- Re-export generated type helpers ----

/** All paths defined in the admin OpenAPI spec. */
export type { paths };

/** All component schemas from admin.yaml. */
export type AdminSchemas = components['schemas'];

// ---- Auth middleware ----

/**
 * Middleware that attaches the current Cognito Bearer token to every
 * outgoing request.  If no tokens are available the request is still
 * sent (the server will return 401).
 */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const tokens = await ensureFreshTokens();
    if (tokens) {
      const token = tokens.idToken || tokens.accessToken;
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
};

// ---- Client singleton ----

function createAdminApi() {
  const base = getApiBaseUrl();
  const client = createClient<paths>({
    baseUrl: base.endsWith('/') ? base.slice(0, -1) : base,
  });
  client.use(authMiddleware);
  return client;
}

/** Lazily-initialised singleton so the base URL is read at first use. */
let _client: ReturnType<typeof createAdminApi> | null = null;

/**
 * Get (or create) the typed admin API client.
 *
 * Every call on this client is fully type-checked against the OpenAPI spec:
 * - Path must exist in the spec
 * - HTTP method must be defined for that path
 * - Query params, path params, and request body are validated
 * - Response type is inferred from the spec
 *
 * Example:
 * ```ts
 * const api = getAdminApi();
 * const { data } = await api.GET('/v1/admin/organizations');
 * //    ^? { items?: Organization[]; next_cursor?: string | null }
 * ```
 */
export function getAdminApi() {
  if (!_client) {
    _client = createAdminApi();
  }
  return _client;
}

/** Reset the cached client (useful in tests or when config changes). */
export function resetAdminApi() {
  _client = null;
}
