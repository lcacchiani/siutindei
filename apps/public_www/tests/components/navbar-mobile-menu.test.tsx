import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NavbarMobileMenu } from '@/components/sections/navbar-mobile-menu';
import enContent from '@/content/en.json';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/',
}));

describe('NavbarMobileMenu', () => {
  it('opens the panel, inerts main content, and closes on Escape', () => {
    render(
      <>
        <main id="main-content">
          <p>Page body</p>
        </main>
        <footer id="contact">Footer</footer>
        <NavbarMobileMenu locale="en" content={enContent.navbar} />
      </>,
    );

    const main = document.getElementById('main-content');
    expect(main?.hasAttribute('inert')).toBe(false);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.navbar.openNavigationMenuAriaLabel,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: enContent.navbar.openNavigationMenuAriaLabel,
      }),
    ).toBeInTheDocument();
    expect(main?.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('contact')?.hasAttribute('inert')).toBe(
      true,
    );
    expect(document.body.classList.contains('navbar-mobile-menu-scroll-lock'))
      .toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(main?.hasAttribute('inert')).toBe(false);
    expect(document.body.classList.contains('navbar-mobile-menu-scroll-lock'))
      .toBe(false);
  });

  it('closes when the backdrop is clicked', () => {
    render(<NavbarMobileMenu locale="en" content={enContent.navbar} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: enContent.navbar.openNavigationMenuAriaLabel,
      }),
    );

    fireEvent.click(screen.getByTestId('navbar-mobile-menu-backdrop'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
