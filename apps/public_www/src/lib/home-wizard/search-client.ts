import { getSearchConfig } from '@/lib/site-config';

export interface SearchActivity {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly categoryId: string | null;
}

export interface SearchLocation {
  readonly areaId: string;
  readonly regionAreaId: string | null;
}

export interface SearchOrganization {
  readonly name: string;
}

export interface ActivitySearchResult {
  readonly activity: SearchActivity;
  readonly organization: SearchOrganization;
  readonly location: SearchLocation;
}

export interface ActivitySearchResponse {
  readonly items: readonly ActivitySearchResult[];
}

export async function fetchActivitiesForWizard(params: {
  readonly age: number;
  readonly categoryIds: readonly string[];
}): Promise<ActivitySearchResponse> {
  const config = getSearchConfig();
  if (!config.apiBaseUrl) {
    throw new Error('Search API is not configured.');
  }

  const url = new URL('/v1/activities/search', config.apiBaseUrl);
  url.searchParams.set('age', String(params.age));
  url.searchParams.set('limit', '200');
  for (const categoryId of params.categoryIds) {
    url.searchParams.append('category_id', categoryId);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  }
  if (config.attestationToken) {
    headers['x-device-attestation'] = config.attestationToken;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    items?: Array<{
      activity: {
        id: string;
        name: string;
        description: string | null;
        category_id?: string | null;
      };
      organization: { name: string };
      location: {
        area_id: string;
        region_area_id?: string | null;
      };
    }>;
  };

  const items = (payload.items ?? []).map((item) => ({
    activity: {
      id: item.activity.id,
      name: item.activity.name,
      description: item.activity.description,
      categoryId: item.activity.category_id ?? null,
    },
    organization: {
      name: item.organization.name,
    },
    location: {
      areaId: item.location.area_id,
      regionAreaId: item.location.region_area_id ?? null,
    },
  }));

  return { items };
}
