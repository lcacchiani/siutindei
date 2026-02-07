'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  listManagerActivities,
  listResource,
} from '../lib/api-client';
import type { ApiMode } from '../lib/resource-api';
import type { Activity } from '../types/admin';

interface UseActivitiesByModeOptions {
  limit?: number;
}

interface UseActivitiesByModeResult {
  items: Activity[];
  isLoading: boolean;
  error: string;
  reload: () => void;
}

export function useActivitiesByMode(
  mode: ApiMode,
  options: UseActivitiesByModeOptions = {}
): UseActivitiesByModeResult {
  const [items, setItems] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'admin') {
        const limit = options.limit ?? 200;
        const response = await listResource<Activity>(
          'activities',
          undefined,
          limit
        );
        setItems(response.items);
      } else {
        const response = await listManagerActivities();
        setItems(response.items);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load activities.';
      setError(message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, options.limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return {
    items,
    isLoading,
    error,
    reload: loadActivities,
  };
}
