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
 */

import createClient, { type Middleware } from 'openapi-fetch';
import type { paths, components } from '../types/api-admin.generated';
import { ensureFreshTokens } from './auth';
import { getApiBaseUrl } from './config';

// ---- Re-export generated type helpers ----

export type { paths };
export type AdminSchemas = components['schemas'];

// ---- Auth middleware ----

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

let _client: ReturnType<typeof createAdminApi> | null = null;

export function getAdminApi() {
  if (!_client) {
    _client = createAdminApi();
  }
  return _client;
}

export function resetAdminApi() {
  _client = null;
}
