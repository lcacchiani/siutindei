import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarketingPage } from '@/components/pages/marketing-page';
import { getContent } from '@/content';

describe('MarketingPage', () => {
  it('renders home grid sections from locale content', () => {
    const content = getContent('en');

    render(
      <MarketingPage
        locale="en"
        content={content}
        body={content.pages.home.body}
        currentPath="/"
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      content.hero.title,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      content.features.title,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
