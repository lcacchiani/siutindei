import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SmallWorldHero } from '@/components/sections/hero/small-world-hero';
import { SearchProvider } from '@/components/shared/search/search-context';
import { getContent } from '@/content';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('SmallWorldHero', () => {
  it('renders the brand story, search bar, and trust badges', () => {
    const content = getContent('en');

    render(
      <SearchProvider>
        <SmallWorldHero
          locale="en"
          copy={content.smallWorld}
          searchBarLabels={content.navbar.searchBar}
        />
      </SearchProvider>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: content.smallWorld.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(content.smallWorld.subtitle),
    ).toBeInTheDocument();

    for (const badge of content.smallWorld.trustBadges) {
      expect(screen.getByText(badge.label)).toBeInTheDocument();
    }

    expect(
      screen.getAllByRole('button', {
        name: content.navbar.searchBar.search,
      }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the fallback landmark bubbles until the 3D scene is ready', () => {
    const content = getContent('en');

    render(
      <SearchProvider>
        <SmallWorldHero
          locale="en"
          copy={content.smallWorld}
          searchBarLabels={content.navbar.searchBar}
        />
      </SearchProvider>,
    );

    expect(
      screen.getByAltText(content.smallWorld.bubbles.peakAlt),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(content.smallWorld.bubbles.ferryAlt),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(content.smallWorld.bubbles.tramAlt),
    ).toBeInTheDocument();
  });
});
