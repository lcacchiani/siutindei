/**
 * Unified resource API helpers for both admin and owner modes.
 *
 * Admin mode: Full access to all resources via /v1/admin/*
 * Owner mode: Filtered access to owned resources via /v1/owner/*
 */

import {
  ApiError,
  createResource,
  deleteResource,
  listResource,
  updateResource,
  listOwnerOrganizations,
  createOwnerLocation,
  createOwnerActivity,
  createOwnerPricing,
  createOwnerSchedule,
  listOwnerLocations,
  listOwnerActivities,
  listOwnerPricing,
  listOwnerSchedules,
  updateOwnerOrganization,
  updateOwnerLocation,
  updateOwnerActivity,
  updateOwnerPricing,
  updateOwnerSchedule,
  deleteOwnerOrganization,
  deleteOwnerLocation,
  deleteOwnerActivity,
  deleteOwnerPricing,
  deleteOwnerSchedule,
  type ListResponse,
} from './api-client';

export type ApiMode = 'admin' | 'owner';

export type ResourceType =
  | 'organizations'
  | 'locations'
  | 'activities'
  | 'pricing'
  | 'schedules';

export interface ResourceApi<T> {
  list: (cursor?: string) => Promise<ListResponse<T>>;
  create?: <TInput>(payload: TInput) => Promise<T>;
  update: <TInput>(id: string, payload: TInput) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

/**
 * Get the appropriate API functions for a resource based on mode.
 */
export function getResourceApi<T>(
  resource: ResourceType,
  mode: ApiMode
): ResourceApi<T> {
  if (mode === 'admin') {
    return {
      list: (cursor?: string) => listResource<T>(resource, cursor),
      create: <TInput>(payload: TInput) =>
        createResource<TInput, T>(resource, payload),
      update: <TInput>(id: string, payload: TInput) =>
        updateResource<TInput, T>(resource, id, payload),
      delete: (id: string) => deleteResource(resource, id),
    };
  }

  // Owner mode - use owner-specific endpoints
  switch (resource) {
    case 'organizations':
      return {
        list: () =>
          listOwnerOrganizations() as unknown as Promise<ListResponse<T>>,
        // Owners cannot create organizations
        update: <TInput>(id: string, payload: TInput) =>
          updateOwnerOrganization(id, payload) as unknown as Promise<T>,
        delete: (id: string) => deleteOwnerOrganization(id),
      };
    case 'locations':
      return {
        list: () => listOwnerLocations() as unknown as Promise<ListResponse<T>>,
        create: <TInput>(payload: TInput) =>
          createOwnerLocation(payload) as unknown as Promise<T>,
        update: <TInput>(id: string, payload: TInput) =>
          updateOwnerLocation(id, payload) as unknown as Promise<T>,
        delete: (id: string) => deleteOwnerLocation(id),
      };
    case 'activities':
      return {
        list: () =>
          listOwnerActivities() as unknown as Promise<ListResponse<T>>,
        create: <TInput>(payload: TInput) =>
          createOwnerActivity(payload) as unknown as Promise<T>,
        update: <TInput>(id: string, payload: TInput) =>
          updateOwnerActivity(id, payload) as unknown as Promise<T>,
        delete: (id: string) => deleteOwnerActivity(id),
      };
    case 'pricing':
      return {
        list: () => listOwnerPricing() as unknown as Promise<ListResponse<T>>,
        create: <TInput>(payload: TInput) =>
          createOwnerPricing(payload) as unknown as Promise<T>,
        update: <TInput>(id: string, payload: TInput) =>
          updateOwnerPricing(id, payload) as unknown as Promise<T>,
        delete: (id: string) => deleteOwnerPricing(id),
      };
    case 'schedules':
      return {
        list: () => listOwnerSchedules() as unknown as Promise<ListResponse<T>>,
        create: <TInput>(payload: TInput) =>
          createOwnerSchedule(payload) as unknown as Promise<T>,
        update: <TInput>(id: string, payload: TInput) =>
          updateOwnerSchedule(id, payload) as unknown as Promise<T>,
        delete: (id: string) => deleteOwnerSchedule(id),
      };
    default:
      throw new Error(`Unknown resource type: ${resource}`);
  }
}

export { ApiError };
