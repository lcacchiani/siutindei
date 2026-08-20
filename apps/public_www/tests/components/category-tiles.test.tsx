import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CategoryTiles } from '@/components/sections/discovery/category-tiles';
import { SearchProvider } from '@/components/shared/search/search-context';
import { getContent } from '@/content';
import { homeWizardChoices } from '@/lib/home-wizard/choices';

function renderTiles() {
  const content = getContent('en');
  render(
    <SearchProvider>
      <CategoryTiles locale="en" copy={content.smallWorld.categories} />
    </SearchProvider>,
  );
  return content;
}

describe('CategoryTiles', () => {
  it('renders one tactile tile per activity type with its 3D icon', () => {
    const content = renderTiles();

    expect(
      screen.getByRole('heading', {
        name: content.smallWorld.categories.title,
      }),
    ).toBeInTheDocument();

    for (const type of homeWizardChoices.activityTypes) {
      const tile = screen.getByRole('button', { name: type.labels.en });
      expect(tile).toHaveAttribute('aria-pressed', 'false');
      expect(tile.querySelector('img.category-tile__icon')).not.toBeNull();
    }
  });

  it('toggles the activity type filter when a tile is pressed', () => {
    renderTiles();

    const firstType = homeWizardChoices.activityTypes[0];
    const tile = screen.getByRole('button', { name: firstType.labels.en });

    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'false');
  });
});
