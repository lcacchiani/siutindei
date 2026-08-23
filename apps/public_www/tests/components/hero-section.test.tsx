import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroSection } from '@/components/sections/grid/hero-section';
import { getContent } from '@/content';

describe('HeroSection', () => {
  it('styles the primary CTA like other accent buttons', () => {
    const content = getContent('en');

    render(
      <HeroSection
        locale="en"
        content={content.hero}
        eyebrow="About us"
        primaryCtaLabel="Explore activities"
        primaryCtaHref="/"
        secondaryCtaLabel="Contact"
        secondaryCtaHref="#contact"
      />,
    );

    const primaryCta = screen.getByRole('link', {
      name: 'Explore activities',
    });
    const secondaryCta = screen.getByRole('link', { name: 'Contact' });

    expect(primaryCta).toHaveAttribute('href', '/en/');
    expect(primaryCta).toHaveClass('bg-accent-500', 'text-ink-900');
    expect(primaryCta).not.toHaveClass('bg-ink-900', 'text-white');

    expect(secondaryCta).toHaveAttribute('href', '/en/#contact');
    expect(secondaryCta).toHaveClass('border-ink-900/15', 'text-ink-900');
  });
});
