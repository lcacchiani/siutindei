import { describe, expect, it } from 'vitest';

import {
  AGE_ICON_SRC,
  ALL_HONG_KONG_ICON_SRC,
  REGION_ICON_SRC,
  REGION_MAP_CLASS,
  REGION_MAP_ORDER,
  iconSrcForActivity,
  iconSrcForAge,
  iconSrcForRegion,
} from '@/lib/home-wizard/choice-icons';
import { homeWizardChoices } from '@/lib/home-wizard/choices';

describe('choice icons', () => {
  it('maps every activity type to a category illustration', () => {
    for (const type of homeWizardChoices.activityTypes) {
      expect(iconSrcForActivity(type.id)).toMatch(
        /^\/images\/categories\/.+\.svg$/,
      );
    }
  });

  it('maps every age group to a kawaii age illustration', () => {
    expect(Object.keys(AGE_ICON_SRC)).toEqual(
      homeWizardChoices.ageGroups.map((group) => group.id),
    );
    for (const group of homeWizardChoices.ageGroups) {
      expect(iconSrcForAge(group.id)).toMatch(/^\/images\/ages\/.+\.svg$/);
    }
  });

  it('maps every region onto the Hong Kong layout', () => {
    expect([...REGION_MAP_ORDER].sort()).toEqual(
      homeWizardChoices.regions.map((region) => region.id).sort(),
    );
    for (const region of homeWizardChoices.regions) {
      expect(iconSrcForRegion(region.id)).toBe(REGION_ICON_SRC[region.id]);
      expect(REGION_MAP_CLASS[region.id]).toMatch(/md:col-start-/);
    }
    expect(ALL_HONG_KONG_ICON_SRC).toBe('/images/flags/hong-kong.svg');
  });
});
