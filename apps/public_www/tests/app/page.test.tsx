import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the brand name in the hero', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /siu tin dei/i }),
    ).toBeInTheDocument();
  });

  it('renders the features section', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 2, name: /why siu tin dei/i }),
    ).toBeInTheDocument();
  });

  it('renders a footer with copyright', () => {
    render(<HomePage />);
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
  });
});
