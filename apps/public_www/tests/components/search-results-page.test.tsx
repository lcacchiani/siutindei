import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchResultsPage } from '@/components/pages/search-results-page';
import { SearchProvider } from '@/components/shared/search/search-context';
import { getContent } from '@/content';
import { fetchActivitySearch } from '@/lib/activities/search-client';
import type { ActivityListing } from '@/lib/activities/types';

const push = vi.hoisted(() => vi.fn());
const mapsEnabled = vi.hoisted(() => ({ value: true }));
const currentSearchParams = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => currentSearchParams.value,
}));

vi.mock('@/lib/google-maps/config', () => ({
  isGoogleMapsEnabled: () => mapsEnabled.value,
}));

vi.mock('@/lib/activities/search-client', () => ({
  fetchActivitySearch: vi.fn().mockResolvedValue({
    items: [],
    nextCursor: null,
  }),
}));

vi.mock('@/components/shared/maps/activity-google-map', () => ({
  ActivityGoogleMap: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="application" aria-label={ariaLabel} />
  ),
}));

function buildListing(): ActivityListing {
  return {
    activity: {
      id: 'act-1',
      name: 'Kowloon art',
      description: null,
      nameTranslations: {},
      descriptionTranslations: {},
      ageMin: null,
      ageMax: null,
      categoryId: 'c1111111-1111-1111-1111-111111111101',
    },
    organization: {
      id: 'org-1',
      name: 'Studio',
      description: null,
      nameTranslations: {},
      mediaUrls: [],
      logoMediaUrl: null,
    },
    location: {
      id: 'loc-1',
      areaId: 'a1111111-1111-1111-1111-111111111102',
      regionAreaId: 'a1111111-1111-1111-1111-111111111102',
      address: null,
      lat: 22.3193,
      lng: 114.1694,
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

function renderPage() {
  const copy = getContent('en').searchPage;
  render(
    <SearchProvider>
      <SearchResultsPage locale="en" copy={copy} />
    </SearchProvider>,
  );
  return copy;
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    push.mockClear();
    mapsEnabled.value = true;
    currentSearchParams.value = new URLSearchParams();
    vi.mocked(fetchActivitySearch).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
  });

  it('hides the name search field and activity count', async () => {
    const copy = renderPage();

    await waitFor(() => {
      expect(screen.getByText(copy.emptyLabel)).toBeInTheDocument();
    });

    expect(
      screen.queryByPlaceholderText('Search by name or organization'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ activities$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
  });

  it('overlays a map toggle on the list when maps are enabled', async () => {
    const copy = renderPage();

    const toggle = await screen.findByRole('button', {
      name: copy.mapViewLabel,
    });
    expect(toggle.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/map.svg',
    );
    expect(toggle).toHaveClass('search-view-toggle', 'fixed', 'rounded-full', 'bg-white');
    expect(toggle.parentElement).toBe(document.body);

    fireEvent.click(toggle);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('view=map'));
  });

  it('overlays a list toggle on the map when maps are enabled', async () => {
    currentSearchParams.value = new URLSearchParams('view=map');
    const copy = renderPage();

    const toggle = await screen.findByRole('button', {
      name: copy.listViewLabel,
    });
    expect(toggle.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/list.svg',
    );

    fireEvent.click(toggle);
    expect(push).toHaveBeenCalled();
    expect(push.mock.calls[0][0]).not.toContain('view=map');
  });

  it('auto-selects a filtered pin and links the map card to activity details', async () => {
    currentSearchParams.value = new URLSearchParams('view=map');
    vi.mocked(fetchActivitySearch).mockResolvedValue({
      items: [buildListing()],
      nextCursor: null,
    });
    renderPage();

    const summaryLink = await screen.findByRole('link', {
      name: /Kowloon art/,
    });
    expect(summaryLink).toHaveAttribute('href', '/en/activity?id=act-1');
    expect(
      document.querySelector('.search-map-split-layout__list'),
    ).toHaveClass('hidden', 'lg:block');
  });

  it('hides the view toggle when maps are disabled', async () => {
    mapsEnabled.value = false;
    const copy = renderPage();

    await waitFor(() => {
      expect(screen.getByText(copy.emptyLabel)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: copy.mapViewLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.listViewLabel }),
    ).not.toBeInTheDocument();
  });
});
