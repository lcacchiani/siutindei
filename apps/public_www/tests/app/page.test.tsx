import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DiscoveryHomePage } from '@/components/pages/discovery-home-page';
import { PageLayout } from '@/components/shared/page-layout';
import { getContent } from '@/content';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/',
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/activities/search-client', () => ({
  fetchActivitySearch: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));

describe('DiscoveryHomePage', () => {
  it('renders discovery chrome with search and carousel headings', () => {
    const content = getContent('en');

    render(
      <PageLayout
        locale="en"
        navbarContent={content.navbar}
        footerContent={content.footer}
      >
        <DiscoveryHomePage locale="en" content={content} />
      </PageLayout>,
    );

    expect(
      screen.getAllByRole('button', { name: content.navbar.searchBar.search })
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(content.discovery.popularTitle)).toBeInTheDocument();
    expect(screen.getByText(content.hostCta.title)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: content.features.title })).toBeInTheDocument();
  });
});
