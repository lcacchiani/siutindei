import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NavbarLanguageSwitcher } from '@/components/sections/navbar-language-switcher';
import { getContent } from '@/content';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/about/',
}));

describe('NavbarLanguageSwitcher', () => {
  it('renders circular UK and Hong Kong flags instead of EN/TC labels', () => {
    const content = getContent('en');

    render(
      <NavbarLanguageSwitcher locale="en" content={content.navbar} />,
    );

    expect(screen.queryByText('EN')).toBeNull();
    expect(screen.queryByText('TC')).toBeNull();

    const english = screen.getByRole('link', { name: 'English' });
    const chinese = screen.getByRole('link', { name: '繁體中文' });

    expect(english).toHaveAttribute('href', '/en/about/');
    expect(english).toHaveAttribute('aria-current', 'page');
    expect(chinese).toHaveAttribute('href', '/zh-HK/about/');
    expect(chinese).not.toHaveAttribute('aria-current');

    const englishFlag = english.querySelector('img');
    const chineseFlag = chinese.querySelector('img');

    expect(englishFlag).toHaveAttribute('src', '/images/flags/uk.svg');
    expect(chineseFlag).toHaveAttribute(
      'src',
      '/images/flags/hong-kong.svg',
    );
    expect(englishFlag).toHaveClass('rounded-full');
    expect(chineseFlag).toHaveClass('rounded-full');
  });
});
