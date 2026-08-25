import type { ApiKey, ApiKeyCreate, ApiKeyCreated } from '../types/admin';
import { buildApiUrl, request } from './api-client-core';

export interface ApiKeysResponse {
  items: ApiKey[];
  next_cursor?: string | null;
}

function buildApiKeysUrl(id?: string) {
  return id
    ? buildApiUrl(`v1/admin/api-keys/${id}`)
    : buildApiUrl('v1/admin/api-keys');
}

export async function listApiKeys(
  cursor?: string,
  limit = 50
): Promise<ApiKeysResponse> {
  const url = new URL(buildApiKeysUrl());
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  url.searchParams.set('limit', `${limit}`);
  return request<ApiKeysResponse>(url.toString());
}

export async function createApiKey(
  payload: ApiKeyCreate
): Promise<ApiKeyCreated> {
  return request<ApiKeyCreated>(buildApiKeysUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getApiKey(id: string): Promise<ApiKey> {
  return request<ApiKey>(buildApiKeysUrl(id));
}

export async function revokeApiKey(id: string): Promise<ApiKey> {
  return request<ApiKey>(buildApiKeysUrl(id), {
    method: 'DELETE',
  });
}
