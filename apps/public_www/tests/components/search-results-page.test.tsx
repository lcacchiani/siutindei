import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchResultsPage } from '@/components/pages/search-results-page';
import { SearchProvider } from '@/components/shared/search/search-context';
import { getContent } from '@/content';

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
    expect(toggle).toHaveClass('fixed', 'rounded-full', 'bg-white');

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
