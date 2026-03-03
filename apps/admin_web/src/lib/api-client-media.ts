import { buildApiUrl, request } from './api-client-core';

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

function buildOrganizationMediaUrl(organizationId: string) {
  return buildApiUrl(`v1/admin/organizations/${organizationId}/media`);
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
