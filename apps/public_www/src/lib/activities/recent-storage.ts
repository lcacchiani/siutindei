import type { SearchFiltersState } from './search-params';

const RECENT_SEARCH_KEY = 'siutindei.recentSearch';
const RECENT_VIEWED_KEY = 'siutindei.recentViewed';
const MAX_RECENT = 8;

export function loadRecentSearch(): SearchFiltersState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SearchFiltersState;
  } catch {
    return null;
  }
}

export function saveRecentSearch(filters: SearchFiltersState): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(filters));
  } catch {
    // Ignore quota errors.
  }
}

export function loadRecentViewedIds(): readonly string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_VIEWED_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function rememberViewedActivity(activityId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const existing = loadRecentViewedIds().filter((id) => id !== activityId);
  const next = [activityId, ...existing].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors.
  }
}
