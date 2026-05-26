import type { Locale } from '@/content';
import { homeWizardChoices } from '@/lib/home-wizard/choices';
import { localizePath } from '@/lib/locale-routing';
import type { ActivityListing } from '@/lib/activities/types';

import {
  buildSearchQueryString,
  type SearchFiltersState,
  type SearchViewMode,
} from './search-params';

export function regionIdForListing(listing: ActivityListing): string | null {
  const areaId =
    listing.location.regionAreaId ?? listing.location.areaId;
  const match = homeWizardChoices.regions.find(
    (region) => region.areaId === areaId,
  );
  return match?.id ?? null;
}

export function buildMapSearchHref(
  locale: Locale,
  filters: SearchFiltersState,
): string {
  const query = buildSearchQueryString(filters, { view: 'map' });
  return query
    ? `${localizePath('/search', locale)}?${query}`
    : `${localizePath('/search', locale)}?view=map`;
}

export function buildMapSearchHrefForRegion(
  locale: Locale,
  baseFilters: SearchFiltersState,
  regionId: string,
): string {
  return buildMapSearchHref(locale, {
    ...baseFilters,
    regionId,
  });
}

export type { SearchViewMode };
