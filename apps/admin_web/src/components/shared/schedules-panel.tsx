'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useActivitiesByMode } from '../../hooks/use-activities-by-mode';
import { useLocationsByMode } from '../../hooks/use-locations-by-mode';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import { parseOptionalNumber } from '../../lib/number-parsers';
import type { ApiMode } from '../../lib/resource-api';
import type { LanguageCode } from '../../lib/translations';
import { languageOptions } from '../../lib/translations';
import type { ActivitySchedule } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';


interface WeeklyEntryForm {
  id: string;
  day_of_week_local: string;
  start_minutes_local: string;
  end_minutes_local: string;
}

interface ScheduleFormState {
  activity_id: string;
  location_id: string;
  schedule_type: 'weekly';
  weekly_entries: WeeklyEntryForm[];
  languages: LanguageCode[];
}

const emptyForm: ScheduleFormState = {
  activity_id: '',
  location_id: '',
  schedule_type: 'weekly',
  weekly_entries: [],
  languages: [],
};

const dayOfWeekOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const minutesPerDay = 24 * 60;
const halfHourMinutes = 30;
const defaultStartMinutes = 10 * 60;
const defaultDurationMinutes = 60;
const defaultEndMinutes =
  (defaultStartMinutes + defaultDurationMinutes) % minutesPerDay;

function formatTimeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const paddedHours = `${hours}`.padStart(2, '0');
  const paddedMinutes = `${mins}`.padStart(2, '0');
  return `${paddedHours}:${paddedMinutes}`;
}

const timeOptions = Array.from(
  { length: minutesPerDay / halfHourMinutes },
  (_, index) => {
    const minutes = index * halfHourMinutes;
    return { value: `${minutes}`, label: formatTimeLabel(minutes) };
  }
);

function getTimeOptions(value: string) {
  if (!value) {
    return timeOptions;
  }

  if (timeOptions.some((option) => option.value === value)) {
    return timeOptions;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return timeOptions;
  }

  if (numeric < 0 || numeric >= minutesPerDay) {
    return timeOptions;
  }

  const rounded = Math.round(numeric);
  const extraOption = {
    value,
    label: formatTimeLabel(rounded),
  };

  return [...timeOptions, extraOption].sort(
    (left, right) => Number(left.value) - Number(right.value)
  );
}

function addMinutes(baseMinutes: number, extraMinutes: number): number {
  const total = baseMinutes + extraMinutes;
  return ((total % minutesPerDay) + minutesPerDay) % minutesPerDay;
}

function getLocalWeekdayBase(dayOfWeek: number): Date {
  const today = new Date();
  const todayDay = today.getDay();
  const delta = dayOfWeek - todayDay;
  const base = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  base.setDate(base.getDate() + delta);
  return base;
}

function getUtcWeekdayBase(dayOfWeek: number): Date {
  const today = new Date();
  const todayDay = today.getUTCDay();
  const delta = dayOfWeek - todayDay;
  const base = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  base.setUTCDate(base.getUTCDate() + delta);
  return base;
}

function buildLocalDate(
  base: Date,
  minutes: number,
  dayOffset: number
): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + dayOffset,
    hours,
    mins
  );
}

function buildUtcDate(base: Date, minutes: number, dayOffset: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dayOffset,
      hours,
      mins
    )
  );
}

function localMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function utcMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function toUtcWeekly(
  localDayOfWeek: number,
  localStartMinutes: number,
  localEndMinutes: number
) {
  const base = getLocalWeekdayBase(localDayOfWeek);
  const wraps = localStartMinutes > localEndMinutes;
  const startLocal = buildLocalDate(base, localStartMinutes, 0);
  const endLocal = buildLocalDate(base, localEndMinutes, wraps ? 1 : 0);
  return {
    dayOfWeek: startLocal.getUTCDay(),
    startMinutes: utcMinutes(startLocal),
    endMinutes: utcMinutes(endLocal),
  };
}

function fromUtcWeekly(
  utcDayOfWeek: number,
  utcStartMinutes: number,
  utcEndMinutes: number
) {
  const base = getUtcWeekdayBase(utcDayOfWeek);
  const wraps = utcStartMinutes > utcEndMinutes;
  const startUtc = buildUtcDate(base, utcStartMinutes, 0);
  const endUtc = buildUtcDate(base, utcEndMinutes, wraps ? 1 : 0);
  const startLocal = new Date(startUtc.getTime());
  const endLocal = new Date(endUtc.getTime());
  return {
    dayOfWeek: startLocal.getDay(),
    startMinutes: localMinutes(startLocal),
    endMinutes: localMinutes(endLocal),
  };
}

const languageCodeSet = new Set<LanguageCode>(
  languageOptions.map((option) => option.code)
);

function toLanguageCodes(value?: string[] | null): LanguageCode[] {
  if (!value) return [];
  return value.filter((code): code is LanguageCode =>
    languageCodeSet.has(code as LanguageCode)
  );
}

function getLanguageOption(code: string) {
  return languageOptions.find((option) => option.code === code) ?? null;
}

function entryToForm(
  entry: ActivitySchedule['weekly_entries'][number],
  index: number
): WeeklyEntryForm {
  const localSchedule = fromUtcWeekly(
    entry.day_of_week_utc,
    entry.start_minutes_utc,
    entry.end_minutes_utc
  );
  return {
    id: `entry-${entry.day_of_week_utc}-${entry.start_minutes_utc}-${index}`,
    day_of_week_local: `${localSchedule.dayOfWeek}`,
    start_minutes_local: `${localSchedule.startMinutes}`,
    end_minutes_local: `${localSchedule.endMinutes}`,
  };
}

function itemToForm(item: ActivitySchedule): ScheduleFormState {
  const weeklyEntries = (item.weekly_entries ?? []).map(entryToForm);
  return {
    activity_id: item.activity_id ?? '',
    location_id: item.location_id ?? '',
    schedule_type: 'weekly',
    weekly_entries: weeklyEntries,
    languages: toLanguageCodes(item.languages),
  };
}

interface SchedulesPanelProps {
  mode: ApiMode;
}

export function SchedulesPanel({ mode }: SchedulesPanelProps) {
  const panel = useResourcePanel<ActivitySchedule, ScheduleFormState>(
    'schedules',
    mode,
    emptyForm,
    itemToForm
  );
  const { editingId, formState, setFormState } = panel;

  const { items: activities } = useActivitiesByMode(mode, { limit: 200 });
  const { items: locations } = useLocationsByMode(mode, { limit: 200 });
  const entryIdRef = useRef(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const [touchedState, setTouchedState] = useState<{
    key: string;
    fields: Record<string, boolean>;
  }>({ key: '', fields: {} });
  const [submittedState, setSubmittedState] = useState<{
    key: string;
    value: boolean;
  }>({ key: '', value: false });

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';

  const markTouched = (field: string) => {
    setTouchedState((prev) => {
      if (prev.key !== formKey) {
        return { key: formKey, fields: { [field]: true } };
      }
      if (prev.fields[field]) {
        return prev;
      }
      return { key: formKey, fields: { ...prev.fields, [field]: true } };
    });
    setSubmittedState((prev) => {
      if (prev.key !== formKey || isFormEmpty) {
        return { key: formKey, value: false };
      }
      return prev;
    });
  };

  useEffect(() => {
    if (editingId) {
      return;
    }
    const defaultActivityId =
      activities.length === 1 ? activities[0]?.id ?? '' : '';
    const defaultLocationId =
      locations.length === 1 ? locations[0]?.id ?? '' : '';
    const shouldSetActivityDefault =
      Boolean(defaultActivityId) && !formState.activity_id;
    const shouldSetLocationDefault =
      Boolean(defaultLocationId) && !formState.location_id;
    if (!shouldSetActivityDefault && !shouldSetLocationDefault) {
      return;
    }
    setFormState((prev) => {
      const nextActivityId = prev.activity_id || defaultActivityId;
      const nextLocationId = prev.location_id || defaultLocationId;
      if (
        nextActivityId === prev.activity_id &&
        nextLocationId === prev.location_id
      ) {
        return prev;
      }
      return {
        ...prev,
        activity_id: nextActivityId,
        location_id: nextLocationId,
      };
    });
  }, [
    activities,
    locations,
    editingId,
    formState.activity_id,
    formState.location_id,
    setFormState,
  ]);

  const isFormEmpty =
    panel.formState.activity_id === '' &&
    panel.formState.location_id === '' &&
    panel.formState.weekly_entries.length === 0 &&
    panel.formState.languages.length === 0;

  const formKey = panel.editingId ?? 'new';
  const activeTouchedFields =
    isFormEmpty || touchedState.key !== formKey ? {} : touchedState.fields;
  const hasSubmitted =
    isFormEmpty || submittedState.key !== formKey ? false : submittedState.value;

  const validate = () => {
    const form = panel.formState;
    if (!form.activity_id || !form.location_id) {
      return 'Activity and location are required.';
    }
    if (form.weekly_entries.length === 0) {
      return 'Select at least one day and timeslot.';
    }
    for (const entry of form.weekly_entries) {
      const dayOfWeek = parseOptionalNumber(entry.day_of_week_local);
      const startMinutes = parseOptionalNumber(entry.start_minutes_local);
      const endMinutes = parseOptionalNumber(entry.end_minutes_local);
      if (dayOfWeek === null || startMinutes === null || endMinutes === null) {
        return 'Each timeslot needs a day and time range.';
      }
      if (startMinutes === endMinutes) {
        return 'Timeslots need a non-zero time range.';
      }
    }
    if (form.languages.length === 0) {
      return 'Select at least one language.';
    }
    return null;
  };

  const locationError = panel.formState.location_id
    ? ''
    : 'Select a location.';
  const activityError = panel.formState.activity_id
    ? ''
    : 'Select an activity.';
  const daysError =
    panel.formState.weekly_entries.length > 0
      ? ''
      : 'Select at least one day.';
  const languagesError =
    panel.formState.languages.length > 0
      ? ''
      : 'Select at least one language.';

  const entryErrors = useMemo(() => {
    const errors: Record<
      string,
      { start: string; end: string; range: string }
    > = {};
    for (const entry of panel.formState.weekly_entries) {
      const startMinutes = parseOptionalNumber(entry.start_minutes_local);
      const endMinutes = parseOptionalNumber(entry.end_minutes_local);
      let startError = '';
      let endError = '';
      let rangeError = '';
      if (startMinutes === null) {
        startError = 'Select a start time.';
      }
      if (endMinutes === null) {
        endError = 'Select an end time.';
      }
      if (
        startMinutes !== null &&
        endMinutes !== null &&
        startMinutes === endMinutes
      ) {
        rangeError = 'Timeslots need a non-zero time range.';
      }
      errors[entry.id] = {
        start: startError,
        end: endError,
        range: rangeError,
      };
    }
    return errors;
  }, [panel.formState.weekly_entries]);

  const formToPayload = (form: ScheduleFormState) => {
    const weeklyEntries = form.weekly_entries
      .map((entry) => {
        const dayOfWeek = parseOptionalNumber(entry.day_of_week_local);
        const startMinutes = parseOptionalNumber(entry.start_minutes_local);
        const endMinutes = parseOptionalNumber(entry.end_minutes_local);
        if (
          dayOfWeek === null ||
          startMinutes === null ||
          endMinutes === null
        ) {
          return null;
        }
        const utcSchedule = toUtcWeekly(dayOfWeek, startMinutes, endMinutes);
        return {
          day_of_week_utc: utcSchedule.dayOfWeek,
          start_minutes_utc: utcSchedule.startMinutes,
          end_minutes_utc: utcSchedule.endMinutes,
        };
      })
      .filter(
        (entry): entry is {
          day_of_week_utc: number;
          start_minutes_utc: number;
          end_minutes_utc: number;
        } => entry !== null
      );

    return {
      activity_id: form.activity_id,
      location_id: form.location_id,
      schedule_type: 'weekly',
      weekly_entries: weeklyEntries,
      languages: form.languages,
    };
  };

  const handleSubmit = () => {
    setSubmittedState({ key: formKey, value: true });
    return panel.handleSubmit(formToPayload, validate);
  };

  const selectedLanguages = new Set(panel.formState.languages);
  const selectedDays = new Set(
    panel.formState.weekly_entries.map((entry) => entry.day_of_week_local)
  );

  const entriesByDay = dayOfWeekOptions.map((option) => {
    const entries = panel.formState.weekly_entries
      .filter((entry) => entry.day_of_week_local === option.value)
      .sort((left, right) => {
        const leftStart = parseOptionalNumber(left.start_minutes_local) ?? 0;
        const rightStart = parseOptionalNumber(right.start_minutes_local) ?? 0;
        return leftStart - rightStart;
      });
    return { ...option, entries };
  });

  const nextEntryId = (dayOfWeek: string) => {
    const nextId = entryIdRef.current;
    entryIdRef.current += 1;
    return `entry-${dayOfWeek}-${nextId}`;
  };

  const createEntry = (dayOfWeek: string): WeeklyEntryForm => ({
    id: nextEntryId(dayOfWeek),
    day_of_week_local: dayOfWeek,
    start_minutes_local: `${defaultStartMinutes}`,
    end_minutes_local: `${defaultEndMinutes}`,
  });

  const toggleDay = (dayOfWeek: string) => {
    markTouched('days');
    panel.setFormState((prev) => {
      const hasDay = prev.weekly_entries.some(
        (entry) => entry.day_of_week_local === dayOfWeek
      );
      if (hasDay) {
        return {
          ...prev,
          weekly_entries: prev.weekly_entries.filter(
            (entry) => entry.day_of_week_local !== dayOfWeek
          ),
        };
      }
      return {
        ...prev,
        weekly_entries: [...prev.weekly_entries, createEntry(dayOfWeek)],
      };
    });
  };

  const addTimeslot = (dayOfWeek: string) => {
    panel.setFormState((prev) => ({
      ...prev,
      weekly_entries: [...prev.weekly_entries, createEntry(dayOfWeek)],
    }));
  };

  const updateEntry = (
    entryId: string,
    updates: Partial<WeeklyEntryForm>
  ) => {
    panel.setFormState((prev) => ({
      ...prev,
      weekly_entries: prev.weekly_entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...updates } : entry
      ),
    }));
  };

  const updateEntryStartTime = (entryId: string, value: string) => {
    markTouched(`entry-${entryId}-start`);
    const startMinutes = parseOptionalNumber(value);
    if (startMinutes === null) {
      updateEntry(entryId, {
        start_minutes_local: value,
        end_minutes_local: '',
      });
      return;
    }
    const endMinutes = addMinutes(startMinutes, defaultDurationMinutes);
    updateEntry(entryId, {
      start_minutes_local: value,
      end_minutes_local: `${endMinutes}`,
    });
  };

  const removeEntry = (entryId: string) => {
    panel.setFormState((prev) => ({
      ...prev,
      weekly_entries: prev.weekly_entries.filter(
        (entry) => entry.id !== entryId
      ),
    }));
  };

  function getActivityName(activityId: string) {
    return activities.find((activity) => activity.id === activityId)?.name ??
      activityId;
  }

  function getLocationName(locationId: string) {
    return locations.find((location) => location.id === locationId)?.address ??
      locationId;
  }

  function toggleLanguage(code: LanguageCode) {
    markTouched('languages');
    panel.setFormState((prev) => {
      const isSelected = prev.languages.includes(code);
      const nextLanguages = isSelected
        ? prev.languages.filter((language) => language !== code)
        : [...prev.languages, code];
      return { ...prev, languages: nextLanguages };
    });
  }

  function getLocalEntries(item: ActivitySchedule) {
    const entries = item.weekly_entries ?? [];
    return entries
      .map((entry) => {
        const localSchedule = fromUtcWeekly(
          entry.day_of_week_utc,
          entry.start_minutes_utc,
          entry.end_minutes_utc
        );
        return {
          dayOfWeek: localSchedule.dayOfWeek,
          startMinutes: localSchedule.startMinutes,
          endMinutes: localSchedule.endMinutes,
        };
      })
      .sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) {
          return left.dayOfWeek - right.dayOfWeek;
        }
        if (left.startMinutes !== right.startMinutes) {
          return left.startMinutes - right.startMinutes;
        }
        return left.endMinutes - right.endMinutes;
      });
  }

  function getDayLabel(dayOfWeek: number) {
    return (
      dayOfWeekOptions.find((option) => Number(option.value) === dayOfWeek)
        ?.label ?? `Day ${dayOfWeek}`
    );
  }

  function renderWeeklyEntries(item: ActivitySchedule) {
    const localEntries = getLocalEntries(item);
    if (localEntries.length === 0) {
      return <span>—</span>;
    }
    return (
      <div className='space-y-1 text-slate-600'>
        {localEntries.map((entry) => (
          <div
            key={`${entry.dayOfWeek}-${entry.startMinutes}-${entry.endMinutes}`}
          >
            <span className='font-medium text-slate-700'>
              {getDayLabel(entry.dayOfWeek)}
            </span>{' '}
            {formatTimeLabel(entry.startMinutes)}-
            {formatTimeLabel(entry.endMinutes)}
          </div>
        ))}
      </div>
    );
  }

  function weeklyEntriesLabel(item: ActivitySchedule) {
    const localEntries = getLocalEntries(item);
    return localEntries
      .map((entry) => {
        const label = getDayLabel(entry.dayOfWeek);
        const start = formatTimeLabel(entry.startMinutes);
        const end = formatTimeLabel(entry.endMinutes);
        return `${label} ${start}-${end}`;
      })
      .join(', ');
  }

  const columns = [
    {
      key: 'location',
      header: 'Location',
      primary: true,
      render: (item: ActivitySchedule) => (
        <span className='font-medium'>
          {getLocationName(item.location_id)}
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      secondary: true,
      render: (item: ActivitySchedule) => (
        <span className='text-slate-600'>
          {getActivityName(item.activity_id)}
        </span>
      ),
    },
    {
      key: 'day-time',
      header: 'Day/Time',
      render: (item: ActivitySchedule) => renderWeeklyEntries(item),
    },
    {
      key: 'languages',
      header: 'Languages',
      render: (item: ActivitySchedule) => (
        <div className='flex flex-wrap items-center gap-2 text-slate-600'>
          {item.languages?.length ? (
            item.languages.map((language) => {
              const option = getLanguageOption(language);
              if (!option) {
                return (
                  <span key={language} className='text-xs uppercase'>
                    {language}
                  </span>
                );
              }
              return (
                <span
                  key={option.code}
                  className='inline-flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-1'
                  title={option.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={option.flagSrc}
                    alt={`${option.label} flag`}
                    width={20}
                    height={14}
                    loading='lazy'
                  />
                </span>
              );
            })
          ) : (
            <span>—</span>
          )}
        </div>
      ),
    },
  ];

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const activityName = getActivityName(item.activity_id).toLowerCase();
    const locationName = getLocationName(item.location_id).toLowerCase();
    const languagesStr = item.languages?.join(', ')?.toLowerCase() || '';
    const entriesLabel = weeklyEntriesLabel(item).toLowerCase();
    return (
      activityName.includes(query) ||
      locationName.includes(query) ||
      entriesLabel.includes(query) ||
      languagesStr.includes(query)
    );
  });

  const showLocationError = Boolean(
    locationError &&
      (hasSubmitted || activeTouchedFields.location_id)
  );
  const showActivityError = Boolean(
    activityError &&
      (hasSubmitted || activeTouchedFields.activity_id)
  );
  const showDaysError = Boolean(
    daysError &&
      (hasSubmitted || activeTouchedFields.days)
  );
  const showLanguagesError = Boolean(
    languagesError &&
      (hasSubmitted || activeTouchedFields.languages)
  );

  return (
    <div className='space-y-6'>
      <Card title='Schedules' description='Manage schedule entries.'>
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='schedule-location'>
              Location{' '}
              <span className='ml-1'>{requiredIndicator}</span>
            </Label>
            <Select
              id='schedule-location'
              value={panel.formState.location_id}
              onChange={(e) => {
                markTouched('location_id');
                panel.setFormState((prev) => ({
                  ...prev,
                  location_id: e.target.value,
                }));
              }}
              className={showLocationError ? errorInputClassName : ''}
              aria-invalid={showLocationError || undefined}
            >
              <option value=''>Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.address || location.area_id}
                </option>
              ))}
            </Select>
            {showLocationError ? (
              <p className='text-xs text-red-600'>{locationError}</p>
            ) : null}
          </div>
          <div className='space-y-1'>
            <Label htmlFor='schedule-activity'>
              Activity{' '}
              <span className='ml-1'>{requiredIndicator}</span>
            </Label>
            <Select
              id='schedule-activity'
              value={panel.formState.activity_id}
              onChange={(e) => {
                markTouched('activity_id');
                panel.setFormState((prev) => ({
                  ...prev,
                  activity_id: e.target.value,
                }));
              }}
              className={showActivityError ? errorInputClassName : ''}
              aria-invalid={showActivityError || undefined}
            >
              <option value=''>Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
            {showActivityError ? (
              <p className='text-xs text-red-600'>{activityError}</p>
            ) : null}
          </div>
          <div className='md:col-span-2'>
            <div className='space-y-2'>
              <Label id='schedule-days-label'>
                Days of Week{' '}
                <span className='ml-1'>{requiredIndicator}</span>
              </Label>
              <p id='schedule-days-help' className='text-xs text-slate-500'>
                Select one or more days, then add timeslots.
              </p>
              <div
                role='group'
                aria-labelledby='schedule-days-label'
                aria-describedby='schedule-days-help'
                className={`flex flex-wrap items-center gap-2 ${
                  showDaysError ? 'ring-1 ring-red-500 rounded-md p-2' : ''
                }`}
              >
                {dayOfWeekOptions.map((option) => {
                  const isSelected = selectedDays.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => toggleDay(option.value)}
                      className={`rounded border px-2 py-1 text-sm transition ${
                        isSelected
                          ? 'border-slate-400 bg-slate-50 ring-2 ring-slate-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {option.label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {showDaysError ? (
                <p className='text-xs text-red-600'>{daysError}</p>
              ) : null}
            </div>
          </div>
          {entriesByDay
            .filter((day) => day.entries.length > 0)
            .map((day) => (
              <div key={day.value} className='md:col-span-2'>
                <div className='space-y-3 rounded border border-slate-200 bg-slate-50 p-4'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div>
                      <p className='text-sm font-semibold text-slate-900'>
                        {day.label}
                      </p>
                      <p className='text-xs text-slate-500'>
                        Add one or more timeslots.
                      </p>
                    </div>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => toggleDay(day.value)}
                    >
                      Remove day
                    </Button>
                  </div>
                  <div className='space-y-3'>
                    {day.entries.map((entry) => {
                      const startId = `schedule-${day.value}-${entry.id}-start`;
                      const endId = `schedule-${day.value}-${entry.id}-end`;
                      const startTouchedKey = `entry-${entry.id}-start`;
                      const endTouchedKey = `entry-${entry.id}-end`;
                      const startOptions = getTimeOptions(
                        entry.start_minutes_local
                      );
                      const endOptions = getTimeOptions(
                        entry.end_minutes_local
                      );
                      const entryError = entryErrors[entry.id] ?? {
                        start: '',
                        end: '',
                        range: '',
                      };
                      const showStartError = Boolean(
                        entryError.start &&
                          (hasSubmitted ||
                            activeTouchedFields[startTouchedKey])
                      );
                      const showEndError = Boolean(
                        entryError.end &&
                          (hasSubmitted ||
                            activeTouchedFields[endTouchedKey])
                      );
                      const showRangeError = Boolean(
                        entryError.range &&
                          (hasSubmitted ||
                            activeTouchedFields[startTouchedKey] ||
                            activeTouchedFields[endTouchedKey])
                      );
                      return (
                        <div
                          key={entry.id}
                          className='grid gap-3 md:grid-cols-[1fr_1fr_auto]'
                        >
                          <div>
                            <Label htmlFor={startId}>
                              Start Time (Local){' '}
                              <span className='ml-1'>{requiredIndicator}</span>
                            </Label>
                            <Select
                              id={startId}
                              value={entry.start_minutes_local}
                              onChange={(e) =>
                                updateEntryStartTime(entry.id, e.target.value)
                              }
                              className={
                                showStartError || showRangeError
                                  ? errorInputClassName
                                  : ''
                              }
                              aria-invalid={
                                showStartError || showRangeError || undefined
                              }
                            >
                              <option value=''>Select time</option>
                              {startOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            {showStartError ? (
                              <p className='text-xs text-red-600'>
                                {entryError.start}
                              </p>
                            ) : null}
                          </div>
                          <div>
                            <Label htmlFor={endId}>
                              End Time (Local){' '}
                              <span className='ml-1'>{requiredIndicator}</span>
                            </Label>
                            <Select
                              id={endId}
                              value={entry.end_minutes_local}
                              onChange={(e) => {
                                markTouched(endTouchedKey);
                                updateEntry(entry.id, {
                                  end_minutes_local: e.target.value,
                                });
                              }}
                              className={
                                showEndError || showRangeError
                                  ? errorInputClassName
                                  : ''
                              }
                              aria-invalid={
                                showEndError || showRangeError || undefined
                              }
                            >
                              <option value=''>Select time</option>
                              {endOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            {showEndError ? (
                              <p className='text-xs text-red-600'>
                                {entryError.end}
                              </p>
                            ) : showRangeError ? (
                              <p className='text-xs text-red-600'>
                                {entryError.range}
                              </p>
                            ) : null}
                          </div>
                          <div className='flex items-end'>
                            <Button
                              type='button'
                              size='sm'
                              variant='ghost'
                              onClick={() => removeEntry(entry.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      onClick={() => addTimeslot(day.value)}
                    >
                      Add timeslot
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          <div className='md:col-span-2'>
            <div className='space-y-2'>
              <Label id='schedule-languages-label'>
                Languages{' '}
                <span className='ml-1'>{requiredIndicator}</span>
              </Label>
              <p
                id='schedule-languages-help'
                className='text-xs text-slate-500'
              >
                Select one or more flags.
              </p>
              <div
                role='group'
                aria-labelledby='schedule-languages-label'
                aria-describedby='schedule-languages-help'
                className={`flex flex-wrap items-center gap-2 ${
                  showLanguagesError ? 'ring-1 ring-red-500 rounded-md p-2' : ''
                }`}
              >
                {languageOptions.map((option) => {
                  const isSelected = selectedLanguages.has(option.code);
                  return (
                    <button
                      key={option.code}
                      type='button'
                      onClick={() => toggleLanguage(option.code)}
                      className={`relative flex items-center justify-center rounded border px-2 py-1 transition ${
                        isSelected
                          ? 'border-slate-400 bg-slate-50 ring-2 ring-slate-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`Toggle ${option.label}`}
                      title={option.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.flagSrc}
                        alt={`${option.label} flag`}
                        width={40}
                        height={28}
                        loading='lazy'
                      />
                    </button>
                  );
                })}
              </div>
              {showLanguagesError ? (
                <p className='text-xs text-red-600'>{languagesError}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={panel.isSaving}
          >
            {panel.editingId ? 'Update Schedule' : 'Add Schedule'}
          </Button>
          {panel.editingId && (
            <Button
              type='button'
              variant='secondary'
              onClick={panel.resetForm}
              disabled={panel.isSaving}
            >
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <Card
        title='Existing Schedules'
        description='Select a schedule to edit or delete.'
      >
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading schedules...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>No schedules yet.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search schedules...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredItems}
              keyExtractor={(item) => item.id}
              onEdit={(item) => panel.startEdit(item)}
              onDelete={(item) =>
                panel.handleDelete({
                  ...item,
                  name: getActivityName(item.activity_id),
                })
              }
              nextCursor={panel.nextCursor}
              onLoadMore={panel.loadMore}
              isLoading={panel.isLoading}
              emptyMessage={
                searchQuery.trim()
                  ? 'No schedules match your search.'
                  : 'No schedules yet.'
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
