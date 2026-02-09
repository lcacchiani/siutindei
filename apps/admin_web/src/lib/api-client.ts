import { ensureFreshTokens } from './auth';
import { getApiBaseUrl } from './config';

export type ResourceName =
  | 'organizations'
  | 'locations'
  | 'activity-categories'
  | 'activities'
  | 'pricing'
  | 'schedules'
  | 'feedback-labels'
  | 'organization-feedback';

export interface ListResponse<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  county?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  [key: string]: string | undefined;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
  type: string;
}

export interface AddressSearchResponse {
  items: NominatimResult[];
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

export type AdminImportRecordType =
  | 'organizations'
  | 'locations'
  | 'activities'
  | 'pricing'
  | 'schedules';

export type AdminImportStatus = 'created' | 'updated' | 'failed' | 'skipped';

export interface AdminImportPresignRequest {
  file_name: string;
  content_type: string;
}

export interface AdminImportPresignResponse {
  upload_url: string;
  object_key: string;
  expires_in: number;
}

export interface AdminImportRequest {
  object_key: string;
}

export interface AdminImportError {
  message: string;
  field?: string | null;
}

export interface AdminImportResult {
  type: AdminImportRecordType;
  key: string;
  status: AdminImportStatus;
  id?: string | null;
  path?: string | null;
  warnings: string[];
  errors: AdminImportError[];
}

export interface AdminImportCounts {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
}

export interface AdminImportSummary {
  organizations: AdminImportCounts;
  locations: AdminImportCounts;
  activities: AdminImportCounts;
  pricing: AdminImportCounts;
  schedules: AdminImportCounts;
  warnings: number;
  errors: number;
}

export interface AdminImportResponse {
  summary: AdminImportSummary;
  results: AdminImportResult[];
  file_warnings: string[];
}

export interface AdminExportResponse {
  download_url: string;
  object_key: string;
  file_name: string;
  expires_in: number;
  warnings?: string[];
}

export interface CognitoUsersResponse {
  items: import('../types/admin').CognitoUser[];
  pagination_token?: string | null;
}

export interface OrganizationLookup {
  id: string;
  name: string;
}

export interface OrganizationLookupListResponse {
  items: OrganizationLookup[];
}

export interface UserFeedbackResponse {
  has_pending_feedback: boolean;
  feedbacks: Ticket[];
}

export interface UserFeedbackCreatePayload {
  organization_id: string;
  stars: number;
  label_ids?: string[];
  description?: string;
}

export interface UserFeedbackSubmitResponse {
  message: string;
  ticket_id: string;
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

function buildAdminImportsUrl(suffix?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const path = suffix ? `v1/admin/imports/${suffix}` : 'v1/admin/imports';
  return new URL(path, normalized).toString();
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

export async function createAdminImportPresign(
  payload: AdminImportPresignRequest
) {
  return request<AdminImportPresignResponse>(buildAdminImportsUrl('presign'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function runAdminImport(payload: AdminImportRequest) {
  return request<AdminImportResponse>(buildAdminImportsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function createAdminExport(orgName?: string) {
  const url = new URL(buildAdminImportsUrl('export'));
  if (orgName) {
    url.searchParams.set('org_name', orgName);
  }
  return request<AdminExportResponse>(url.toString());
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

function buildUserGroupsUrl(username: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(`v1/admin/users/${encodeURIComponent(username)}/groups`, normalized).toString();
}

export interface UserGroupResponse {
  status: 'added' | 'removed';
  group: string;
}

/**
 * Add a user to a Cognito group (promote).
 */
export async function addUserToGroup(
  username: string,
  group: string
): Promise<UserGroupResponse> {
  return request<UserGroupResponse>(buildUserGroupsUrl(username), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ group }),
  });
}

/**
 * Remove a user from a Cognito group (demote).
 */
export async function removeUserFromGroup(
  username: string,
  group: string
): Promise<UserGroupResponse> {
  return request<UserGroupResponse>(buildUserGroupsUrl(username), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ group }),
  });
}

export interface DeleteCognitoUserResponse {
  status: 'deleted';
  username: string;
  user_sub: string;
  transferred_organizations_count: number;
  fallback_manager_id: string;
}

/**
 * Delete a Cognito user and transfer their organizations to a fallback manager.
 * The fallback manager is the admin calling the API.
 */
export async function deleteCognitoUser(
  username: string
): Promise<DeleteCognitoUserResponse> {
  const url = `${buildCognitoUsersUrl()}/${encodeURIComponent(username)}`;
  return request<DeleteCognitoUserResponse>(url, {
    method: 'DELETE',
  });
}

// --- Manager-specific API methods ---

export interface ManagerStatusResponse {
  has_pending_request: boolean;
  pending_request: Ticket | null;
  organizations_count: number;
}

export interface SubmitAccessRequestPayload {
  organization_name: string;
  request_message?: string;
}

export interface SubmitAccessRequestResponse {
  message: string;
  ticket_id: string;
}

function buildManagerUrl(resource: string, id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/manager/${resource}/${id}` : `v1/manager/${resource}`;
  return new URL(suffix, normalized).toString();
}

// --- User-specific API methods (any logged-in user) ---

function buildUserUrl(resource: string, id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/user/${resource}/${id}` : `v1/user/${resource}`;
  return new URL(suffix, normalized).toString();
}

export async function searchAddress(
  query: string,
  options: { countryCodes?: string; limit?: number } = {}
): Promise<NominatimResult[]> {
  const url = new URL(buildUserUrl('address-search'));
  url.searchParams.set('q', query);
  if (options.countryCodes) {
    url.searchParams.set('countrycodes', options.countryCodes);
  }
  if (options.limit) {
    url.searchParams.set('limit', `${options.limit}`);
  }
  const response = await request<AddressSearchResponse>(url.toString());
  return response.items;
}

/**
 * Get user's access request status including pending requests and organizations count.
 * Available to any logged-in user.
 */
export async function getUserAccessStatus(): Promise<ManagerStatusResponse> {
  return request<ManagerStatusResponse>(buildUserUrl('access-request'));
}

/**
 * Submit a new organization access request.
 * Available to any logged-in user requesting to become a manager.
 */
export async function submitAccessRequest(
  payload: SubmitAccessRequestPayload
): Promise<SubmitAccessRequestResponse> {
  return request<SubmitAccessRequestResponse>(buildUserUrl('access-request'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

// --- User Organization Suggestions ---

export interface UserSuggestionsResponse {
  has_pending_suggestion: boolean;
  suggestions: Ticket[];
}

export interface SubmitSuggestionPayload {
  organization_name: string;
  description?: string;
  suggested_district?: string;
  suggested_address?: string;
  suggested_lat?: number;
  suggested_lng?: number;
  media_urls?: string[];
  additional_notes?: string;
}

export interface SubmitSuggestionResponse {
  message: string;
  ticket_id: string;
}

/**
 * Get user's organization suggestion history.
 * Available to any logged-in user.
 */
export async function getUserSuggestions(): Promise<UserSuggestionsResponse> {
  return request<UserSuggestionsResponse>(buildUserUrl('organization-suggestion'));
}

/**
 * Submit a new organization suggestion.
 * Available to any logged-in user.
 */
export async function submitOrganizationSuggestion(
  payload: SubmitSuggestionPayload
): Promise<SubmitSuggestionResponse> {
  return request<SubmitSuggestionResponse>(
    buildUserUrl('organization-suggestion'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

// --- User Feedback ---

export async function listFeedbackLabels(): Promise<
  ListResponse<import('../types/admin').FeedbackLabel>
> {
  return request<ListResponse<import('../types/admin').FeedbackLabel>>(
    buildUserUrl('feedback-labels')
  );
}

export async function searchUserOrganizations(
  query: string,
  limit = 20
): Promise<OrganizationLookupListResponse> {
  const url = new URL(buildUserUrl('organizations'));
  url.searchParams.set('q', query);
  url.searchParams.set('limit', `${limit}`);
  return request<OrganizationLookupListResponse>(url.toString());
}

export async function getUserFeedback(): Promise<UserFeedbackResponse> {
  return request<UserFeedbackResponse>(buildUserUrl('organization-feedback'));
}

export async function submitUserFeedback(
  payload: UserFeedbackCreatePayload
): Promise<UserFeedbackSubmitResponse> {
  return request<UserFeedbackSubmitResponse>(
    buildUserUrl('organization-feedback'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

// --- Geographic Areas ---

/** A node in the geographic area tree. */
export interface GeographicAreaNode {
  id: string;
  parent_id: string | null;
  name: string;
  name_translations: Record<string, string>;
  level: 'country' | 'region' | 'city' | 'district';
  code: string | null;
  active: boolean;
  display_order: number;
  children: GeographicAreaNode[];
}

/**
 * Fetch the active geographic area tree (for any authenticated user).
 */
export async function fetchActiveAreas(): Promise<{ items: GeographicAreaNode[] }> {
  return request<{ items: GeographicAreaNode[] }>(buildUserUrl('areas'));
}

// --- Activity Categories ---

/** A node in the activity category tree. */
export interface ActivityCategoryNode {
  id: string;
  parent_id: string | null;
  name: string;
  name_translations: Record<string, string>;
  display_order: number;
  children: ActivityCategoryNode[];
}

/**
 * Fetch the activity category tree (for any authenticated user).
 */
export async function fetchActivityCategories(): Promise<{
  items: ActivityCategoryNode[];
}> {
  return request<{ items: ActivityCategoryNode[] }>(
    buildUserUrl('activity-categories')
  );
}

/**
 * List organizations managed by the current user.
 */
export async function listManagerOrganizations(): Promise<
  ListResponse<import('../types/admin').Organization>
> {
  return request<ListResponse<import('../types/admin').Organization>>(
    buildManagerUrl('organizations')
  );
}

/**
 * Get a specific organization managed by the current user.
 */
export async function getManagerOrganization(
  id: string
): Promise<import('../types/admin').Organization> {
  return request<import('../types/admin').Organization>(
    buildManagerUrl('organizations', id)
  );
}

/**
 * Update an organization managed by the current user.
 */
export async function updateManagerOrganization<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').Organization> {
  return request<import('../types/admin').Organization>(
    buildManagerUrl('organizations', id),
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
 * Delete an organization managed by the current user.
 */
export async function deleteManagerOrganization(id: string): Promise<void> {
  return request<void>(buildManagerUrl('organizations', id), {
    method: 'DELETE',
  });
}

// --- Manager Locations ---

/**
 * List locations in organizations managed by the current user.
 */
export async function listManagerLocations(): Promise<
  ListResponse<import('../types/admin').Location>
> {
  return request<ListResponse<import('../types/admin').Location>>(
    buildManagerUrl('locations')
  );
}

/**
 * Get a specific location in a managed organization.
 */
export async function getManagerLocation(
  id: string
): Promise<import('../types/admin').Location> {
  return request<import('../types/admin').Location>(
    buildManagerUrl('locations', id)
  );
}

/**
 * Create a location in a managed organization.
 */
export async function createManagerLocation<TInput>(
  payload: TInput
): Promise<import('../types/admin').Location> {
  return request<import('../types/admin').Location>(buildManagerUrl('locations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Update a location in a managed organization.
 */
export async function updateManagerLocation<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').Location> {
  return request<import('../types/admin').Location>(
    buildManagerUrl('locations', id),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete a location in a managed organization.
 */
export async function deleteManagerLocation(id: string): Promise<void> {
  return request<void>(buildManagerUrl('locations', id), {
    method: 'DELETE',
  });
}

// --- Manager Activities ---

/**
 * List activities in organizations managed by the current user.
 */
export async function listManagerActivities(): Promise<
  ListResponse<import('../types/admin').Activity>
> {
  return request<ListResponse<import('../types/admin').Activity>>(
    buildManagerUrl('activities')
  );
}

/**
 * Get a specific activity in a managed organization.
 */
export async function getManagerActivity(
  id: string
): Promise<import('../types/admin').Activity> {
  return request<import('../types/admin').Activity>(
    buildManagerUrl('activities', id)
  );
}

/**
 * Create an activity in a managed organization.
 */
export async function createManagerActivity<TInput>(
  payload: TInput
): Promise<import('../types/admin').Activity> {
  return request<import('../types/admin').Activity>(
    buildManagerUrl('activities'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Update an activity in a managed organization.
 */
export async function updateManagerActivity<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').Activity> {
  return request<import('../types/admin').Activity>(
    buildManagerUrl('activities', id),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete an activity in a managed organization.
 */
export async function deleteManagerActivity(id: string): Promise<void> {
  return request<void>(buildManagerUrl('activities', id), {
    method: 'DELETE',
  });
}

// --- Manager Pricing ---

/**
 * List pricing in organizations managed by the current user.
 */
export async function listManagerPricing(): Promise<
  ListResponse<import('../types/admin').ActivityPricing>
> {
  return request<ListResponse<import('../types/admin').ActivityPricing>>(
    buildManagerUrl('pricing')
  );
}

/**
 * Get specific pricing in a managed organization.
 */
export async function getManagerPricing(
  id: string
): Promise<import('../types/admin').ActivityPricing> {
  return request<import('../types/admin').ActivityPricing>(buildManagerUrl('pricing', id));
}

/**
 * Create pricing in a managed organization.
 */
export async function createManagerPricing<TInput>(
  payload: TInput
): Promise<import('../types/admin').ActivityPricing> {
  return request<import('../types/admin').ActivityPricing>(buildManagerUrl('pricing'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Update pricing in a managed organization.
 */
export async function updateManagerPricing<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').ActivityPricing> {
  return request<import('../types/admin').ActivityPricing>(
    buildManagerUrl('pricing', id),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete pricing in a managed organization.
 */
export async function deleteManagerPricing(id: string): Promise<void> {
  return request<void>(buildManagerUrl('pricing', id), {
    method: 'DELETE',
  });
}

// --- Manager Schedules ---

/**
 * List schedules in organizations managed by the current user.
 */
export async function listManagerSchedules(): Promise<
  ListResponse<import('../types/admin').ActivitySchedule>
> {
  return request<ListResponse<import('../types/admin').ActivitySchedule>>(
    buildManagerUrl('schedules')
  );
}

/**
 * Get a specific schedule in a managed organization.
 */
export async function getManagerSchedule(
  id: string
): Promise<import('../types/admin').ActivitySchedule> {
  return request<import('../types/admin').ActivitySchedule>(
    buildManagerUrl('schedules', id)
  );
}

/**
 * Create a schedule in a managed organization.
 */
export async function createManagerSchedule<TInput>(
  payload: TInput
): Promise<import('../types/admin').ActivitySchedule> {
  return request<import('../types/admin').ActivitySchedule>(buildManagerUrl('schedules'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Update a schedule in a managed organization.
 */
export async function updateManagerSchedule<TInput>(
  id: string,
  payload: TInput
): Promise<import('../types/admin').ActivitySchedule> {
  return request<import('../types/admin').ActivitySchedule>(
    buildManagerUrl('schedules', id),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete a schedule in a managed organization.
 */
export async function deleteManagerSchedule(id: string): Promise<void> {
  return request<void>(buildManagerUrl('schedules', id), {
    method: 'DELETE',
  });
}


// --- Admin Audit Logs ---

export interface AuditLogsResponse {
  items: import('../types/admin').AuditLog[];
  next_cursor?: string | null;
}

export interface AuditLogsFilters {
  table?: string;
  record_id?: string;
  user_id?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  since?: string;
}

function buildAuditLogsUrl(id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/admin/audit-logs/${id}` : 'v1/admin/audit-logs';
  return new URL(suffix, normalized).toString();
}

/**
 * List audit log entries with optional filtering.
 */
export async function listAuditLogs(
  filters?: AuditLogsFilters,
  cursor?: string,
  limit = 50
): Promise<AuditLogsResponse> {
  const url = new URL(buildAuditLogsUrl());
  url.searchParams.set('limit', `${limit}`);
  if (filters?.table) {
    url.searchParams.set('table', filters.table);
  }
  if (filters?.record_id) {
    url.searchParams.set('record_id', filters.record_id);
  }
  if (filters?.user_id) {
    url.searchParams.set('user_id', filters.user_id);
  }
  if (filters?.action) {
    url.searchParams.set('action', filters.action);
  }
  if (filters?.since) {
    url.searchParams.set('since', filters.since);
  }
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return request<AuditLogsResponse>(url.toString());
}

/**
 * Get a single audit log entry by ID.
 */
export async function getAuditLog(
  id: string
): Promise<import('../types/admin').AuditLog> {
  return request<import('../types/admin').AuditLog>(buildAuditLogsUrl(id));
}

// --- Admin Tickets ---

export type TicketType =
  | 'access_request'
  | 'organization_suggestion'
  | 'organization_feedback';
export type TicketStatus = 'pending' | 'approved' | 'rejected';

export interface Ticket {
  id: string;
  ticket_id: string;
  ticket_type: TicketType;
  organization_name: string;
  message?: string | null;
  status: TicketStatus;
  submitter_email: string;
  submitter_id: string;
  created_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  admin_notes?: string | null;
  // Optional fields (depend on ticket_type)
  description?: string | null;
  suggested_district?: string | null;
  suggested_address?: string | null;
  suggested_lat?: number | null;
  suggested_lng?: number | null;
  media_urls?: string[];
  organization_id?: string | null;
  feedback_stars?: number | null;
  feedback_label_ids?: string[];
  feedback_text?: string | null;
  created_organization_id?: string | null;
}

export interface TicketsListResponse {
  items: Ticket[];
  next_cursor?: string | null;
  pending_count: number;
}

export interface ReviewTicketPayload {
  action: 'approve' | 'reject';
  admin_notes?: string;
  /** Assign an existing organization on approval */
  organization_id?: string;
  /** Create a new organization on approval */
  create_organization?: boolean;
}

export interface ReviewTicketResponse {
  message: string;
  ticket: Ticket;
  organization?: import('../types/admin').Organization;
}

function buildTicketsUrl(id?: string) {
  const base = getApiBaseUrl();
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const suffix = id ? `v1/admin/tickets/${id}` : 'v1/admin/tickets';
  return new URL(suffix, normalized).toString();
}

/**
 * List all tickets for admin review.
 */
export async function listTickets(
  ticketType?: TicketType,
  status?: TicketStatus,
  cursor?: string,
  limit = 50
): Promise<TicketsListResponse> {
  const url = new URL(buildTicketsUrl());
  url.searchParams.set('limit', `${limit}`);
  if (ticketType) {
    url.searchParams.set('ticket_type', ticketType);
  }
  if (status) {
    url.searchParams.set('status', status);
  }
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return request<TicketsListResponse>(url.toString());
}

/**
 * Approve or reject a ticket.
 */
export async function reviewTicket(
  id: string,
  payload: ReviewTicketPayload
): Promise<ReviewTicketResponse> {
  return request<ReviewTicketResponse>(buildTicketsUrl(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
