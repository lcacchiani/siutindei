import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarketingPage } from '@/components/pages/marketing-page';
import { PageLayout } from '@/components/shared/page-layout';
import { getContent } from '@/content';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/',
}));

describe('MarketingPage', () => {
  it('renders home grid sections inside locale chrome', () => {
    const content = getContent('en');

    render(
      <PageLayout
        locale="en"
        navbarContent={content.navbar}
        footerContent={content.footer}
      >
        <MarketingPage
          locale="en"
          content={content}
          body={content.pages.home.body}
        />
      </PageLayout>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      content.hero.title,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      content.features.title,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: content.navbar.openNavigationMenuAriaLabel }),
    ).toBeInTheDocument();

    const gridCells = document.querySelectorAll('.page-body-grid__cell');
    expect(gridCells.length).toBeGreaterThan(0);
    for (const cell of gridCells) {
      expect(cell.className).not.toMatch(/col-\[/);
      expect(cell).toHaveAttribute('data-grid-col-span');
      expect(cell).toHaveAttribute('data-grid-col-start');
    }
  });
});
