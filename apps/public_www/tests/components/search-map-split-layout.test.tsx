import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchMapSplitLayout } from '@/components/sections/search/search-map-split-layout';
import { getContent } from '@/content';
import type { ActivityListing } from '@/lib/activities/types';

const mapsEnabled = vi.hoisted(() => ({ value: true }));

vi.mock('@/lib/google-maps/config', () => ({
  isGoogleMapsEnabled: () => mapsEnabled.value,
}));

vi.mock('@/components/shared/maps/activity-google-map', () => ({
  ActivityGoogleMap: ({
    ariaLabel,
    onSelect,
  }: {
    ariaLabel: string;
    onSelect: (activityId: string) => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onSelect('act-2')}
    >
      Map pins
    </button>
  ),
}));

function buildListing(
  id: string,
  name: string,
  lat: number | null,
): ActivityListing {
  return {
    activity: {
      id,
      name,
      description: null,
      nameTranslations: {},
      descriptionTranslations: {},
      ageMin: null,
      ageMax: null,
      categoryId: 'c1111111-1111-1111-1111-111111111101',
    },
    organization: {
      id: `org-${id}`,
      name: 'Studio',
      description: null,
      nameTranslations: {},
      mediaUrls: [],
      logoMediaUrl: null,
    },
    location: {
      id: `loc-${id}`,
      areaId: 'a1111111-1111-1111-1111-111111111102',
      regionAreaId: 'a1111111-1111-1111-1111-111111111102',
      address: null,
      lat,
      lng: lat === null ? null : 114.1694,
    },
    pricing: {
      pricingType: 'per_class',
      amount: 180,
      currency: 'hkd',
      sessionsCount: null,
      freeTrialClassOffered: false,
    },
    schedule: {
      scheduleType: 'weekly',
      weeklyEntries: [],
      languages: ['en'],
    },
  };
}

const listings: readonly ActivityListing[] = [
  buildListing('act-1', 'Kowloon art', 22.3193),
  buildListing('act-2', 'Harbour music', 22.295),
];

function renderLayout(
  props: Partial<{
    selectedId: string | null;
    isLoading: boolean;
    listings: readonly ActivityListing[];
    onSelect: (activityId: string) => void;
  }> = {},
) {
  const copy = getContent('en').searchPage;
  const onSelect = props.onSelect ?? vi.fn();
  render(
    <SearchMapSplitLayout
      locale="en"
      copy={copy}
      listings={props.listings ?? listings}
      selectedId={props.selectedId ?? 'act-1'}
      onSelect={onSelect}
      isLoading={props.isLoading ?? false}
    />,
  );
  return { copy, onSelect };
}

describe('SearchMapSplitLayout', () => {
  it('hides the result list on mobile and shows a summary card for the selected pin', () => {
    const { copy } = renderLayout();

    const list = document.querySelector('.search-map-split-layout__list');
    expect(list).not.toBeNull();
    expect(list).toHaveClass('hidden', 'lg:block');

    const card = document.querySelector('.search-map-split-layout__card');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('lg:hidden');

    const summaryLink = screen.getByRole('link', { name: /Kowloon art/ });
    expect(summaryLink).toHaveAttribute('href', '/en/activity?id=act-1');
    expect(summaryLink).toHaveTextContent('Kowloon');
    expect(summaryLink).toHaveTextContent('HK$180 / class');

    const enlarge = screen.getByRole('button', {
      name: copy.enlargeMapLabel,
    });
    expect(enlarge).toHaveClass('hidden', 'lg:inline-flex');
    expect(enlarge.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/enlarge-map.svg',
    );
  });

  it('selects a pin on the map so the summary card can open that activity', () => {
    const onSelect = vi.fn();
    const { copy } = renderLayout({ onSelect });

    fireEvent.click(screen.getByRole('button', { name: copy.mapAriaLabel }));
    expect(onSelect).toHaveBeenCalledWith('act-2');
  });

  it('enlarges to the mobile map card and reduces back to the split list', () => {
    const { copy } = renderLayout();

    fireEvent.click(
      screen.getByRole('button', { name: copy.enlargeMapLabel }),
    );

    expect(
      document.querySelector('.search-map-split-layout__list'),
    ).toBeNull();
    expect(
      document.querySelector('.search-map-split-layout--expanded'),
    ).not.toBeNull();
    expect(
      document.querySelector('.search-map-split-layout__card'),
    ).not.toHaveClass('lg:hidden');
    expect(
      screen.queryByRole('button', { name: /Kowloon art/ }),
    ).not.toBeInTheDocument();

    const reduce = screen.getByRole('button', { name: copy.reduceMapLabel });
    expect(reduce.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/reduce-map.svg',
    );

    fireEvent.click(reduce);
    expect(
      document.querySelector('.search-map-split-layout__list'),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: copy.enlargeMapLabel }),
    ).toBeInTheDocument();
  });

  it('keeps the summary card off the map while results are loading', () => {
    const { copy } = renderLayout({ isLoading: true, selectedId: null });

    expect(screen.getAllByText(copy.loadingMapLabel).length).toBeGreaterThan(
      0,
    );
    expect(
      document.querySelector('.search-map-split-layout__card'),
    ).toBeNull();
  });
});
