export const ACTIVITY_ICON_SRC: Record<string, string> = {
  workshop: '/images/categories/workshop.svg',
  class: '/images/categories/class.svg',
  outdoor: '/images/categories/outdoor.svg',
  indoor: '/images/categories/indoor.svg',
};

export const DEFAULT_ACTIVITY_ICON_SRC = ACTIVITY_ICON_SRC.workshop;

export const AGE_ICON_SRC: Record<string, string> = {
  '1-3': '/images/ages/baby.png',
  '3-6': '/images/ages/toddler.png',
  '6-12': '/images/ages/child.png',
};

export const REGION_ICON_SRC: Record<string, string> = {
  hong_kong_island: '/images/regions/hong-kong-island.svg',
  kowloon: '/images/regions/kowloon.svg',
  new_territories: '/images/regions/new-territories.svg',
  islands: '/images/regions/islands.svg',
};

export const ALL_HONG_KONG_ICON_SRC = '/images/flags/hong-kong.svg';

export const REGION_MAP_ORDER = [
  'islands',
  'new_territories',
  'kowloon',
  'hong_kong_island',
] as const;

export const REGION_MAP_CLASS: Record<string, string> = {
  islands: 'md:col-start-1 md:row-start-2',
  new_territories: 'md:col-start-2 md:row-start-2',
  kowloon: 'md:col-start-3 md:row-start-2',
  hong_kong_island: 'md:col-start-2 md:row-start-3',
};

export function iconSrcForActivity(typeId: string): string {
  return ACTIVITY_ICON_SRC[typeId] ?? DEFAULT_ACTIVITY_ICON_SRC;
}

export function iconSrcForAge(ageGroupId: string): string | undefined {
  return AGE_ICON_SRC[ageGroupId];
}

export function iconSrcForRegion(regionId: string): string | undefined {
  return REGION_ICON_SRC[regionId];
}
