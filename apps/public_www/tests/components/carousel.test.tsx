import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Carousel } from '@/components/shared/ui/carousel';

describe('Carousel', () => {
  it('centers square chevron icons in the circular nav buttons', () => {
    render(
      <Carousel
        ariaLabel="Popular activities"
        previousLabel="Previous activities"
        nextLabel="Next activities"
      >
        <div>Card</div>
      </Carousel>,
    );

    const previous = screen.getByRole('button', {
      name: 'Previous activities',
    });
    const next = screen.getByRole('button', { name: 'Next activities' });

    expect(previous).toHaveClass('items-center', 'justify-center', 'p-0');
    expect(next).toHaveClass('items-center', 'justify-center', 'p-0');

    const previousIcon = previous.querySelector('img');
    const nextIcon = next.querySelector('img');

    expect(previousIcon).toHaveAttribute('src', '/images/ui/chevron-left.svg');
    expect(nextIcon).toHaveAttribute('src', '/images/ui/chevron-right.svg');
    expect(previousIcon).toHaveClass('block');
    expect(nextIcon).toHaveClass('block');
    expect(previousIcon).toHaveAttribute('width', '12');
    expect(previousIcon).toHaveAttribute('height', '12');
    expect(nextIcon).toHaveAttribute('width', '12');
    expect(nextIcon).toHaveAttribute('height', '12');
  });

  it('scrolls the track when nav buttons are pressed', () => {
    const scrollBy = vi.fn();

    render(
      <Carousel
        ariaLabel="Popular activities"
        previousLabel="Previous activities"
        nextLabel="Next activities"
      >
        <div>Card</div>
      </Carousel>,
    );

    const track = document.querySelector('.listing-carousel__track');
    expect(track).not.toBeNull();
    Object.defineProperty(track, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(track, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Previous activities' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next activities' }));

    expect(scrollBy).toHaveBeenCalledWith({
      left: -320,
      behavior: 'smooth',
    });
    expect(scrollBy).toHaveBeenCalledWith({
      left: 320,
      behavior: 'smooth',
    });
  });
});
