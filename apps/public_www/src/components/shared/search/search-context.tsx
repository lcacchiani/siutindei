'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SearchFiltersState } from '@/lib/activities/search-params';
import { DEFAULT_SEARCH_FILTERS } from '@/lib/activities/search-params';

interface SearchContextValue {
  readonly filters: SearchFiltersState;
  readonly isSearchOpen: boolean;
  readonly setFilters: (next: SearchFiltersState) => void;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

interface SearchProviderProps {
  readonly children: ReactNode;
  readonly initialFilters?: SearchFiltersState;
}

export function SearchProvider({
  children,
  initialFilters = DEFAULT_SEARCH_FILTERS,
}: SearchProviderProps) {
  const [filters, setFiltersState] = useState<SearchFiltersState>(
    initialFilters,
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const setFilters = useCallback((next: SearchFiltersState) => {
    setFiltersState(next);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      isSearchOpen,
      setFilters,
      openSearch,
      closeSearch,
    }),
    [closeSearch, filters, isSearchOpen, openSearch, setFilters],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within SearchProvider');
  }
  return context;
}
