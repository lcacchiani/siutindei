'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  listManagerOrganizations,
  listResource,
} from '../lib/api-client';
import type { ApiMode } from '../lib/resource-api';
import type { Organization } from '../types/admin';

interface UseOrganizationsByModeOptions {
  limit?: number;
  fetchAll?: boolean;
}

interface UseOrganizationsByModeResult {
  items: Organization[];
  isLoading: boolean;
  error: string;
  reload: () => void;
}

export function useOrganizationsByMode(
  mode: ApiMode,
  options: UseOrganizationsByModeOptions = {}
): UseOrganizationsByModeResult {
  const [items, setItems] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'admin') {
        const limit = options.limit ?? 200;
        if (options.fetchAll) {
          const allItems: Organization[] = [];
          let cursor: string | undefined;
          do {
            const response = await listResource<Organization>(
              'organizations',
              cursor,
              limit
            );
            allItems.push(...response.items);
            cursor = response.next_cursor ?? undefined;
          } while (cursor);
          setItems(allItems);
        } else {
          const response = await listResource<Organization>(
            'organizations',
            undefined,
            limit
          );
          setItems(response.items);
        }
      } else {
        const response = await listManagerOrganizations();
        setItems(response.items);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load organizations.';
      setError(message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, options.fetchAll, options.limit]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  return {
    items,
    isLoading,
    error,
    reload: loadOrganizations,
  };
}
