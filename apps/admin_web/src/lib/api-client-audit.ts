import type { AuditLog } from '../types/admin';
import { buildApiUrl, request } from './api-client-core';

export interface AuditLogsResponse {
  items: AuditLog[];
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
  return id
    ? buildApiUrl(`v1/admin/audit-logs/${id}`)
    : buildApiUrl('v1/admin/audit-logs');
}

export async function listAuditLogs(
  filters?: AuditLogsFilters,
  cursor?: string,
  limit = 50
): Promise<AuditLogsResponse> {
  const url = new URL(buildAuditLogsUrl());

  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  if (limit) {
    url.searchParams.set('limit', `${limit}`);
  }
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

  return request<AuditLogsResponse>(url.toString());
}

export async function getAuditLog(id: string): Promise<AuditLog> {
  return request<AuditLog>(buildAuditLogsUrl(id));
}
