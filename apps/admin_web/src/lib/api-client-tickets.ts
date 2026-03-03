import { buildApiUrl, request } from './api-client-core';

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
  suggested_district?: string | null;
  suggested_address?: string | null;
  suggested_lat?: number | null;
  suggested_lng?: number | null;
  description?: string | null;
  media_urls?: string[];
  feedback_stars?: number | null;
  feedback_label_ids?: string[];
  feedback_text?: string | null;
  status: TicketStatus;
  submitter_id: string;
  submitter_email: string;
  admin_notes?: string | null;
  create_organization?: boolean | null;
  organization_id?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface TicketsListResponse {
  items: Ticket[];
  next_cursor?: string | null;
  pending_count: number;
}

export interface ReviewTicketPayload {
  action: 'approve' | 'reject';
  admin_notes?: string;
  create_organization?: boolean;
  organization_id?: string;
}

export interface ReviewTicketResponse {
  message: string;
  ticket: Ticket;
}

function buildTicketsUrl(id?: string) {
  return id ? buildApiUrl(`v1/admin/tickets/${id}`) : buildApiUrl('v1/admin/tickets');
}

export async function listTickets(
  type?: TicketType,
  status?: TicketStatus,
  cursor?: string
): Promise<TicketsListResponse> {
  const url = new URL(buildTicketsUrl());
  if (type) {
    url.searchParams.set('type', type);
  }
  if (status) {
    url.searchParams.set('status', status);
  }
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return request<TicketsListResponse>(url.toString());
}

export async function reviewTicket(
  ticketId: string,
  payload: ReviewTicketPayload
): Promise<ReviewTicketResponse> {
  return request<ReviewTicketResponse>(buildApiUrl(`v1/admin/tickets/${ticketId}/review`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
