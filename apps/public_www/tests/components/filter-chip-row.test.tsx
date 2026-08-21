import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FilterChipRow } from '@/components/sections/search/filter-chip-row';
import { SearchProvider } from '@/components/shared/search/search-context';
import { iconSrcForActivity } from '@/lib/home-wizard/choice-icons';
import { homeWizardChoices } from '@/lib/home-wizard/choices';

function renderChipRow() {
  render(
    <SearchProvider>
      <FilterChipRow locale="en" />
    </SearchProvider>,
  );
}

describe('FilterChipRow', () => {
  it('places each activity icon to the left of its label', () => {
    renderChipRow();

    for (const type of homeWizardChoices.activityTypes) {
      const chip = screen.getByRole('button', { name: type.labels.en });
      const icon = chip.querySelector('img');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('src', iconSrcForActivity(type.id));
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
      expect(chip.firstElementChild).toBe(icon);
    }
  });

  it('toggles an activity type when its chip is pressed', () => {
    renderChipRow();

    const firstType = homeWizardChoices.activityTypes[0];
    const chip = screen.getByRole('button', { name: firstType.labels.en });

    expect(chip.className).not.toContain('bg-ink-900');

    fireEvent.click(chip);
    expect(chip.className).toContain('bg-ink-900');

    fireEvent.click(chip);
    expect(chip.className).not.toContain('bg-ink-900');
  });
});
