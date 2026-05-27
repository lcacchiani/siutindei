import { homeWizardChoices } from '@/lib/home-wizard/choices';

import type { MapCoordinate } from './coordinates';

const REGION_CENTERS: Record<string, MapCoordinate> = {
  hong_kong_island: { lat: 22.2783, lng: 114.1747 },
  kowloon: { lat: 22.3193, lng: 114.1694 },
  new_territories: { lat: 22.45, lng: 114.17 },
  islands: { lat: 22.2611, lng: 113.9465 },
};

export function centerForRegionId(regionId: string | null): MapCoordinate | null {
  if (!regionId) {
    return null;
  }
  const direct = REGION_CENTERS[regionId];
  if (direct) {
    return direct;
  }
  const region = homeWizardChoices.regions.find((entry) => entry.id === regionId);
  if (!region) {
    return null;
  }
  return REGION_CENTERS[region.id] ?? null;
}
