import type { ActivitySearchResult } from '@/lib/home-wizard/search-client';

export function filterWizardResults(
  items: readonly ActivitySearchResult[],
  regionAreaId: string,
  searchQuery: string,
): readonly ActivitySearchResult[] {
  const query = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (item.location.regionAreaId !== regionAreaId) {
      return false;
    }
    if (query === '') {
      return true;
    }
    const haystack = [
      item.activity.name,
      item.activity.description ?? '',
      item.organization.name,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
