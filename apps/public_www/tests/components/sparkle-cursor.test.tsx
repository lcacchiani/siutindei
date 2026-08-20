import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SparkleCursor } from '@/components/shared/sparkle-cursor';

function mockMatchMedia(results: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: results[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('SparkleCursor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when media queries are unavailable', () => {
    render(<SparkleCursor />);
    expect(screen.queryByTestId('sparkle-cursor')).not.toBeInTheDocument();
  });

  it('renders the overlay canvas for fine pointers without reduced motion', () => {
    mockMatchMedia({
      '(pointer: fine)': true,
      '(prefers-reduced-motion: reduce)': false,
    });

    render(<SparkleCursor />);
    const canvas = screen.getByTestId('sparkle-cursor');
    expect(canvas).toHaveClass('sparkle-cursor-canvas');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  it('stays disabled when the user prefers reduced motion', () => {
    mockMatchMedia({
      '(pointer: fine)': true,
      '(prefers-reduced-motion: reduce)': true,
    });

    render(<SparkleCursor />);
    expect(screen.queryByTestId('sparkle-cursor')).not.toBeInTheDocument();
  });
});
