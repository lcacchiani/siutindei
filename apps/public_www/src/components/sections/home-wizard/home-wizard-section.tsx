'use client';

import { useCallback, useId, useMemo, useState } from 'react';

import type { Locale } from '@/content';
import {
  homeWizardChoices,
  labelForLocale,
} from '@/lib/home-wizard/choices';
import { filterWizardResults } from '@/lib/home-wizard/filter-results';
import {
  fetchActivitiesForWizard,
  type ActivitySearchResult,
} from '@/lib/home-wizard/search-client';

type WizardStep = 'activityTypes' | 'ageGroup' | 'region' | 'results';

interface HomeWizardCopy {
  readonly activityQuestion: string;
  readonly ageQuestion: string;
  readonly regionQuestion: string;
  readonly continueLabel: string;
  readonly searchPlaceholder: string;
  readonly loadingLabel: string;
  readonly emptyLabel: string;
  readonly errorLabel: string;
  readonly retryLabel: string;
}

interface HomeWizardSectionProps {
  readonly locale: Locale;
  readonly copy: HomeWizardCopy;
}

const optionClassName =
  'flex cursor-pointer items-center gap-3 rounded-lg border ' +
  'border-slate-200 px-4 py-3 has-checked:border-brand-500 ' +
  'has-checked:bg-brand-50 focus-within:outline focus-within:outline-2 ' +
  'focus-within:outline-offset-2 focus-within:outline-brand-500';

export function HomeWizardSection({ locale, copy }: HomeWizardSectionProps) {
  const searchInputId = useId();
  const [step, setStep] = useState<WizardStep>('activityTypes');
  const [selectedActivityTypeIds, setSelectedActivityTypeIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string | null>(
    null,
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [prefetchedItems, setPrefetchedItems] = useState<
    readonly ActivitySearchResult[]
  >([]);
  const [filteredItems, setFilteredItems] = useState<
    readonly ActivitySearchResult[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRegion = useMemo(() => {
    if (!selectedRegionId) {
      return null;
    }
    return homeWizardChoices.regions.find(
      (region) => region.id === selectedRegionId,
    );
  }, [selectedRegionId]);

  const applyFilters = useCallback(
    (
      items: readonly ActivitySearchResult[],
      regionAreaId: string,
      query: string,
    ) => {
      setFilteredItems(filterWizardResults(items, regionAreaId, query));
    },
    [],
  );

  const prefetchResults = useCallback(
    async (ageGroupId: string, activityTypeIds: ReadonlySet<string>) => {
      const ageGroup = homeWizardChoices.ageGroups.find(
        (group) => group.id === ageGroupId,
      );
      if (!ageGroup) {
        return;
      }
      const categoryIds = homeWizardChoices.activityTypes
        .filter((type) => activityTypeIds.has(type.id))
        .map((type) => type.categoryId);
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchActivitiesForWizard({
          age: ageGroup.searchAge,
          categoryIds,
        });
        setPrefetchedItems(response.items);
      } catch {
        setErrorMessage(copy.errorLabel);
      } finally {
        setIsLoading(false);
      }
    },
    [copy.errorLabel],
  );

  const toggleActivityType = (activityTypeId: string, checked: boolean) => {
    setSelectedActivityTypeIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(activityTypeId);
      } else {
        next.delete(activityTypeId);
      }
      return next;
    });
    setSelectedAgeGroupId(null);
    setSelectedRegionId(null);
    setPrefetchedItems([]);
    setFilteredItems([]);
    setStep('activityTypes');
  };

  const confirmActivityTypes = () => {
    if (selectedActivityTypeIds.size === 0) {
      return;
    }
    setStep('ageGroup');
  };

  const selectAgeGroup = async (ageGroupId: string) => {
    setSelectedAgeGroupId(ageGroupId);
    setSelectedRegionId(null);
    setFilteredItems([]);
    setStep('region');
    await prefetchResults(ageGroupId, selectedActivityTypeIds);
  };

  const selectRegion = (regionId: string) => {
    const region = homeWizardChoices.regions.find(
      (item) => item.id === regionId,
    );
    if (!region) {
      return;
    }
    setSelectedRegionId(regionId);
    setStep('results');
    applyFilters(prefetchedItems, region.areaId, searchQuery);
  };

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    if (!selectedRegion) {
      return;
    }
    applyFilters(prefetchedItems, selectedRegion.areaId, value);
  };

  const summaryChips = [
    {
      key: 'activity',
      label: homeWizardChoices.activityTypes
        .filter((type) => selectedActivityTypeIds.has(type.id))
        .map((type) => labelForLocale(type.labels, locale))
        .join(', '),
      visible: selectedActivityTypeIds.size > 0,
      onClick: () => setStep('activityTypes'),
    },
    {
      key: 'age',
      label: homeWizardChoices.ageGroups
        .filter((group) => group.id === selectedAgeGroupId)
        .map((group) => labelForLocale(group.labels, locale))
        .join(''),
      visible: selectedAgeGroupId !== null,
      onClick: () => setStep('ageGroup'),
    },
    {
      key: 'region',
      label: homeWizardChoices.regions
        .filter((region) => region.id === selectedRegionId)
        .map((region) => labelForLocale(region.labels, locale))
        .join(''),
      visible: selectedRegionId !== null,
      onClick: () => setStep('region'),
    },
  ];

  return (
    <section
      id="home-wizard"
      className="bg-white text-slate-900"
      data-section-id="home-wizard"
    >
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav aria-label="Selected filters" className="flex flex-wrap gap-2">
          {summaryChips
            .filter((chip) => chip.visible)
            .map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                onClick={chip.onClick}
              >
                {chip.label}
              </button>
            ))}
        </nav>

        {step === 'activityTypes' ? (
          <form
            className="mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              confirmActivityTypes();
            }}
          >
            <fieldset>
              <legend className="text-2xl font-semibold">
                {copy.activityQuestion}
              </legend>
              <ul className="mt-4 space-y-2">
                {homeWizardChoices.activityTypes.map((option) => {
                  const inputId = `activity-type-${option.id}`;
                  return (
                    <li key={option.id}>
                      <label htmlFor={inputId} className={optionClassName}>
                        <input
                          id={inputId}
                          type="checkbox"
                          name="activityType"
                          value={option.id}
                          checked={selectedActivityTypeIds.has(option.id)}
                          onChange={(event) => {
                            toggleActivityType(option.id, event.target.checked);
                          }}
                        />
                        <span>{labelForLocale(option.labels, locale)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <button
              type="submit"
              className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-white disabled:opacity-50"
              disabled={selectedActivityTypeIds.size === 0}
            >
              {copy.continueLabel}
            </button>
          </form>
        ) : null}

        {step === 'ageGroup' ? (
          <fieldset className="mt-8">
            <legend className="text-2xl font-semibold">{copy.ageQuestion}</legend>
            <ul className="mt-4 space-y-2">
              {homeWizardChoices.ageGroups.map((option) => {
                const inputId = `age-group-${option.id}`;
                return (
                  <li key={option.id}>
                    <label htmlFor={inputId} className={optionClassName}>
                      <input
                        id={inputId}
                        type="radio"
                        name="ageGroup"
                        value={option.id}
                        checked={selectedAgeGroupId === option.id}
                        onChange={() => {
                          void selectAgeGroup(option.id);
                        }}
                      />
                      <span>{labelForLocale(option.labels, locale)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}

        {step === 'region' ? (
          <fieldset className="mt-8">
            <legend className="text-2xl font-semibold">
              {copy.regionQuestion}
            </legend>
            {isLoading ? (
              <p
                className="mt-4 text-sm text-slate-600"
                aria-live="polite"
              >
                {copy.loadingLabel}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {homeWizardChoices.regions.map((option) => {
                const inputId = `region-${option.id}`;
                return (
                  <li key={option.id}>
                    <label htmlFor={inputId} className={optionClassName}>
                      <input
                        id={inputId}
                        type="radio"
                        name="region"
                        value={option.id}
                        checked={selectedRegionId === option.id}
                        onChange={() => selectRegion(option.id)}
                      />
                      <span>{labelForLocale(option.labels, locale)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}

        {step === 'results' ? (
          <div className="mt-8">
            <form
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <label
                htmlFor={searchInputId}
                className="block text-sm font-medium text-slate-700"
              >
                {copy.searchPlaceholder}
              </label>
              <input
                id={searchInputId}
                type="search"
                name="q"
                autoComplete="off"
                enterKeyHint="search"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={searchQuery}
                onChange={(event) => updateSearchQuery(event.target.value)}
              />
            </form>
            {errorMessage ? (
              <div className="mt-4" role="alert">
                <p className="text-sm text-red-700">{errorMessage}</p>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-brand-600"
                  onClick={() => {
                    if (selectedAgeGroupId) {
                      void prefetchResults(
                        selectedAgeGroupId,
                        selectedActivityTypeIds,
                      );
                    }
                  }}
                >
                  {copy.retryLabel}
                </button>
              </div>
            ) : null}
            {isLoading ? (
              <p
                className="mt-4 text-sm text-slate-600"
                aria-live="polite"
              >
                {copy.loadingLabel}
              </p>
            ) : null}
            {!isLoading && filteredItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600" aria-live="polite">
                {copy.emptyLabel}
              </p>
            ) : null}
            <ul className="mt-4 space-y-3" aria-live="polite">
              {filteredItems.map((item) => (
                <li
                  key={item.activity.id}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <p className="font-medium">{item.activity.name}</p>
                  <p className="text-sm text-slate-600">
                    {item.organization.name}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
