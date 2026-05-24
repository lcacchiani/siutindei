'use client';

import { useCallback, useMemo, useState } from 'react';

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

export function HomeWizardSection({ locale, copy }: HomeWizardSectionProps) {
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

  const toggleActivityType = (activityTypeId: string) => {
    setSelectedActivityTypeIds((current) => {
      const next = new Set(current);
      if (next.has(activityTypeId)) {
        next.delete(activityTypeId);
      } else {
        next.add(activityTypeId);
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
    const region = homeWizardChoices.regions.find((item) => item.id === regionId);
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
        <div className="flex flex-wrap gap-2">
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
        </div>

        {step === 'activityTypes' ? (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold">{copy.activityQuestion}</h2>
            <ul className="mt-4 space-y-2">
              {homeWizardChoices.activityTypes.map((option) => {
                const selected = selectedActivityTypeIds.has(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={
                        'w-full rounded-lg border px-4 py-3 text-left ' +
                        (selected
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200')
                      }
                      onClick={() => toggleActivityType(option.id)}
                    >
                      {labelForLocale(option.labels, locale)}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-white disabled:opacity-50"
              disabled={selectedActivityTypeIds.size === 0}
              onClick={confirmActivityTypes}
            >
              {copy.continueLabel}
            </button>
          </div>
        ) : null}

        {step === 'ageGroup' ? (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold">{copy.ageQuestion}</h2>
            <ul className="mt-4 space-y-2">
              {homeWizardChoices.ageGroups.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left"
                    onClick={() => selectAgeGroup(option.id)}
                  >
                    {labelForLocale(option.labels, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'region' ? (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold">{copy.regionQuestion}</h2>
            {isLoading ? (
              <p className="mt-4 text-sm text-slate-600">{copy.loadingLabel}</p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {homeWizardChoices.regions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left"
                    onClick={() => selectRegion(option.id)}
                  >
                    {labelForLocale(option.labels, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'results' ? (
          <div className="mt-8">
            <label className="block text-sm font-medium text-slate-700">
              {copy.searchPlaceholder}
              <input
                type="search"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={searchQuery}
                onChange={(event) => updateSearchQuery(event.target.value)}
              />
            </label>
            {errorMessage ? (
              <div className="mt-4">
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
              <p className="mt-4 text-sm text-slate-600">{copy.loadingLabel}</p>
            ) : null}
            {!isLoading && filteredItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">{copy.emptyLabel}</p>
            ) : null}
            <ul className="mt-4 space-y-3">
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
