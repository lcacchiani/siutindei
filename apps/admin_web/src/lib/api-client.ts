import { ensureFreshTokens } from './auth';
import { getApiBaseUrl } from './config';

export type ResourceName =
  | 'organizations'
  | 'locations'
  | 'activities'
  | 'pricing'
  | 'schedules';

export interface ListResponse<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface OrganizationMediaUploadRequest {
  file_name: string;
  content_type: string;
}

export interface OrganizationMediaUploadResponse {
  upload_url: string;
  media_url: string;
  object_key: string;
  expires_in: number;
}

export interface OrganizationMediaDeleteRequest {
  media_url?: string;
  object_key?: string;
}

export interface CognitoUsersResponse {
  items: import('../types/admin').CognitoUser[];
  pagination_token?: string | null;
}

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function buildResourceUrl(resource: ResourceName, id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/admin/${resource}/${id}` : `v1/admin/${resource}`;
  return new URL(suffix, normalized).toString();
}

function buildOrganizationMediaUrl(organizationId: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = `v1/admin/organizations/${organizationId}/media`;
  return new URL(suffix, normalized).toString();
}

async function getAuthHeader() {
  const tokens = await ensureFreshTokens();
  if (!tokens) {
    throw new ApiError('Not authenticated.', 401);
  }
  const token = tokens.idToken || tokens.accessToken;
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = await getAuthHeader();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeader,
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const raw = await response.text();
  const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  if (!response.ok) {
    const message =
      data && typeof data === 'object'
        ? (data.error as string | undefined) ||
          (data.message as string | undefined) ||
          response.statusText
        : response.statusText;
    const detail =
      data && typeof data === 'object'
        ? (data.detail as string | undefined)
        : undefined;
    throw new ApiError(message, response.status, detail);
  }
  return data as T;
}

export async function listResource<T>(
  resource: ResourceName,
  cursor?: string,
  limit = 50
) {
  const url = new URL(buildResourceUrl(resource));
  url.searchParams.set('limit', `${limit}`);
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return request<ListResponse<T>>(url.toString());
}

export async function createResource<TInput, TOutput>(
  resource: ResourceName,
  payload: TInput
) {
  return request<TOutput>(buildResourceUrl(resource), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function updateResource<TInput, TOutput>(
  resource: ResourceName,
  id: string,
  payload: TInput
) {
  return request<TOutput>(buildResourceUrl(resource, id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteResource(resource: ResourceName, id: string) {
  return request<void>(buildResourceUrl(resource, id), {
    method: 'DELETE',
  });
}

export async function createOrganizationMediaUpload(
  organizationId: string,
  payload: OrganizationMediaUploadRequest
) {
  return request<OrganizationMediaUploadResponse>(
    buildOrganizationMediaUrl(organizationId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteOrganizationMedia(
  organizationId: string,
  payload: OrganizationMediaDeleteRequest
) {
  return request<void>(buildOrganizationMediaUrl(organizationId), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function buildCognitoUsersUrl() {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL('v1/admin/cognito-users', normalized).toString();
}

export async function listCognitoUsers(
  paginationToken?: string,
  limit = 50
): Promise<CognitoUsersResponse> {
  const url = new URL(buildCognitoUsersUrl());
  url.searchParams.set('limit', `${limit}`);
  if (paginationToken) {
    url.searchParams.set('pagination_token', paginationToken);
  }
  return request<CognitoUsersResponse>(url.toString());
}

// --- Owner-specific API methods ---

export interface AccessRequest {
  id: string;
  ticket_id: string;
  organization_name: string;
  request_message?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requester_email: string;
  requester_id: string;
  created_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface OwnerStatusResponse {
  has_pending_request: boolean;
  pending_request: AccessRequest | null;
  organizations_count: number;
}

export interface SubmitAccessRequestPayload {
  organization_name: string;
  request_message?: string;
}

export interface SubmitAccessRequestResponse {
  message: string;
  request: AccessRequest;
}

function buildOwnerUrl(resource: string, id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/owner/${resource}/${id}` : `v1/owner/${resource}`;
  return new URL(suffix, normalized).toString();
}

/**
 * Get owner status including pending requests and organizations count.
 */
export async function getOwnerStatus(): Promise<OwnerStatusResponse> {
  return request<OwnerStatusResponse>(buildOwnerUrl('access-request'));
}

/**
 * Submit a new organization access request.
 */
export async function submitAccessRequest(
  payload: SubmitAccessRequestPayload
): Promise<SubmitAccessRequestResponse> {
  return request<SubmitAccessRequestResponse>(buildOwnerUrl('access-request'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * List organizations owned by the current user.
 */
export async function listOwnerOrganizations(): Promise<
  ListResponse<import('../types/admin').Organization>
> {
  return request<ListResponse<import('../types/admin').Organization>>(
    buildOwnerUrl('organizations')
  );
}

/**
 * Get a specific organization owned by the current user.
 */
export async function getOwnerOrganization(
  id: string
): Promise<import('../types/admin').Organization> {
  return request<import('../types/admin').Organization>(
    buildOwnerUrl('organizations', id)
  );
}

/**
 * Update an organization owned by the current user.
 */
export async function updateOwnerOrganization<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').Organization> {
  return request<import('../types/admin').Organization>(
    buildOwnerUrl('organizations', id),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete an organization owned by the current user.
 */
export async function deleteOwnerOrganization(id: string): Promise<void> {
  return request<void>(buildOwnerUrl('organizations', id), {
    method: 'DELETE',
  });
}

// --- Admin access request management ---

export interface ListAccessRequestsResponse {
  items: AccessRequest[];
  next_cursor?: string | null;
}

export interface ReviewAccessRequestPayload {
  action: 'approve' | 'reject';
  message?: string;
}

export interface ReviewAccessRequestResponse {
  message: string;
  request: AccessRequest;
}

function buildAccessRequestsUrl(id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id
    ? `v1/admin/access-requests/${id}`
    : 'v1/admin/access-requests';
  return new URL(suffix, normalized).toString();
}

/**
 * List all access requests for admin review.
 */
export async function listAccessRequests(
  status?: 'pending' | 'approved' | 'rejected',
  cursor?: string,
  limit = 50
): Promise<ListAccessRequestsResponse> {
  const url = new URL(buildAccessRequestsUrl());
  url.searchParams.set('limit', `${limit}`);
  if (status) {
    url.searchParams.set('status', status);
  }
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return request<ListAccessRequestsResponse>(url.toString());
}

/**
 * Approve or reject an access request.
 */
export async function reviewAccessRequest(
  id: string,
  payload: ReviewAccessRequestPayload
): Promise<ReviewAccessRequestResponse> {
  return request<ReviewAccessRequestResponse>(buildAccessRequestsUrl(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
