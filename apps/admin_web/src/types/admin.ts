/**
 * Admin domain types — re-exported from auto-generated OpenAPI types.
 *
 * Types are generated from docs/api/admin.yaml via `npm run generate:api`.
 * Do NOT add hand-written types here; edit the OpenAPI spec instead.
 */

import type { components } from './api-admin.generated';

type S = components['schemas'];

export type Organization = S['Organization'];
export type Location = S['Location'];
export type Activity = S['Activity'];
export type ActivityCategory = S['ActivityCategory'];
export type CognitoUser = S['CognitoUser'];
export type ActivityPricing = S['Pricing'];
export type ActivitySchedule = S['Schedule'];
export type AuditLog = S['AuditLogEntry'];
export type FeedbackLabel = S['FeedbackLabel'];
export type OrganizationFeedback = S['OrganizationFeedback'];
