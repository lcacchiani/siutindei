import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Carousel } from '@/components/shared/ui/carousel';

describe('Carousel', () => {
  it('renders a scrollable track without prev/next buttons', () => {
    render(
      <Carousel ariaLabel="Popular activities">
        <div>Card</div>
      </Carousel>,
    );

    expect(
      screen.getByRole('region', { name: 'Popular activities' }),
    ).toHaveClass('listing-carousel__track');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
  });
});
