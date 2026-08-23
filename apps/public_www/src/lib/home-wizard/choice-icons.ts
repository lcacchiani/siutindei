import { homeWizardChoices } from './choices';

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

export const REGION_ROW_ORDER = [
  'hong_kong_island',
  'kowloon',
  'new_territories',
  'islands',
] as const;

export function iconSrcForActivity(typeId: string): string {
  return ACTIVITY_ICON_SRC[typeId] ?? DEFAULT_ACTIVITY_ICON_SRC;
}

export function activityTypeIdForCategory(
  categoryId: string | null,
): string {
  if (!categoryId) {
    return homeWizardChoices.activityTypes[0]?.id ?? 'workshop';
  }
  const match = homeWizardChoices.activityTypes.find(
    (type) => type.categoryId === categoryId,
  );
  return match?.id ?? homeWizardChoices.activityTypes[0]?.id ?? 'workshop';
}

export function iconSrcForActivityCategory(
  categoryId: string | null,
): string {
  return iconSrcForActivity(activityTypeIdForCategory(categoryId));
}

export function iconSrcForAge(ageGroupId: string): string | undefined {
  return AGE_ICON_SRC[ageGroupId];
}

export function iconSrcForRegion(regionId: string): string | undefined {
  return REGION_ICON_SRC[regionId];
}
