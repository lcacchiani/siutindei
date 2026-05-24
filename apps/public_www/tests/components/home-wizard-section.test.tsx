import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomeWizardSection } from '@/components/sections/home-wizard/home-wizard-section';
import { homeWizardChoices } from '@/lib/home-wizard/choices';

const copy = {
  activityQuestion: 'What activities?',
  ageQuestion: 'How old?',
  regionQuestion: 'Which area?',
  continueLabel: 'Continue',
  searchPlaceholder: 'Search',
  loadingLabel: 'Loading',
  emptyLabel: 'No results',
  errorLabel: 'Error',
  retryLabel: 'Retry',
} as const;

describe('HomeWizardSection', () => {
  it('enables Continue after selecting an activity type', () => {
    render(<HomeWizardSection locale="en" copy={copy} />);

    const continueButton = screen.getByRole('button', { name: copy.continueLabel });
    expect(continueButton).toBeDisabled();

    const firstType = homeWizardChoices.activityTypes[0];
    const option = screen.getByRole('checkbox', {
      name: firstType.labels.en,
    });
    fireEvent.click(option);

    expect(continueButton).toBeEnabled();
  });
});
