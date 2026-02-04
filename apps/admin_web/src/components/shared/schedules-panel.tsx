'use client';

import { useEffect, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import {
  listResource,
  listManagerActivities,
  listManagerLocations,
} from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Activity, ActivitySchedule, Location } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

interface ScheduleFormState {
  activity_id: string;
  location_id: string;
  schedule_type: string;
  day_of_week_utc: string;
  day_of_month: string;
  start_minutes_utc: string;
  end_minutes_utc: string;
  start_at_utc: string;
  end_at_utc: string;
  languages: string;
}

const emptyForm: ScheduleFormState = {
  activity_id: '',
  location_id: '',
  schedule_type: 'weekly',
  day_of_week_utc: '',
  day_of_month: '',
  start_minutes_utc: '',
  end_minutes_utc: '',
  start_at_utc: '',
  end_at_utc: '',
  languages: '',
};

const scheduleOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'date_specific', label: 'Date specific' },
];

function toUtcInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => `${part}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function toUtcIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLanguages(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function itemToForm(item: ActivitySchedule): ScheduleFormState {
  return {
    activity_id: item.activity_id ?? '',
    location_id: item.location_id ?? '',
    schedule_type: item.schedule_type,
    day_of_week_utc:
      item.day_of_week_utc !== undefined && item.day_of_week_utc !== null
        ? `${item.day_of_week_utc}`
        : '',
    day_of_month:
      item.day_of_month !== undefined && item.day_of_month !== null
        ? `${item.day_of_month}`
        : '',
    start_minutes_utc:
      item.start_minutes_utc !== undefined && item.start_minutes_utc !== null
        ? `${item.start_minutes_utc}`
        : '',
    end_minutes_utc:
      item.end_minutes_utc !== undefined && item.end_minutes_utc !== null
        ? `${item.end_minutes_utc}`
        : '',
    start_at_utc: toUtcInputValue(item.start_at_utc),
    end_at_utc: toUtcInputValue(item.end_at_utc),
    languages: item.languages?.join(', ') ?? '',
  };
}

interface SchedulesPanelProps {
  mode: ApiMode;
}

export function SchedulesPanel({ mode }: SchedulesPanelProps) {
  const isAdmin = mode === 'admin';
  const panel = useResourcePanel<ActivitySchedule, ScheduleFormState>(
    'schedules',
    mode,
    emptyForm,
    itemToForm
  );

  const [activities, setActivities] = useState<Activity[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadReferences = async () => {
      try {
        if (isAdmin) {
          const [activitiesResponse, locationsResponse] = await Promise.all([
            listResource<Activity>('activities', undefined, 200),
            listResource<Location>('locations', undefined, 200),
          ]);
          setActivities(activitiesResponse.items);
          setLocations(locationsResponse.items);
        } else {
          const [activitiesResponse, locationsResponse] = await Promise.all([
            listManagerActivities(),
            listManagerLocations(),
          ]);
          setActivities(activitiesResponse.items);
          setLocations(locationsResponse.items);
        }
      } catch {
        setActivities([]);
        setLocations([]);
      }
    };
    loadReferences();
  }, [isAdmin]);

  const validate = () => {
    const form = panel.formState;
    if (!form.activity_id || !form.location_id) {
      return 'Activity and location are required.';
    }
    if (form.schedule_type === 'weekly') {
      const dayOfWeek = parseOptionalNumber(form.day_of_week_utc);
      const startMinutes = parseOptionalNumber(form.start_minutes_utc);
      const endMinutes = parseOptionalNumber(form.end_minutes_utc);
      if (dayOfWeek === null || startMinutes === null || endMinutes === null) {
        return 'Weekly schedules need day and time range.';
      }
      if (startMinutes >= endMinutes) {
        return 'Weekly schedules need a valid time range.';
      }
    }
    if (form.schedule_type === 'monthly') {
      const dayOfMonth = parseOptionalNumber(form.day_of_month);
      const startMinutes = parseOptionalNumber(form.start_minutes_utc);
      const endMinutes = parseOptionalNumber(form.end_minutes_utc);
      if (dayOfMonth === null || startMinutes === null || endMinutes === null) {
        return 'Monthly schedules need day of month and time range.';
      }
      if (startMinutes >= endMinutes) {
        return 'Monthly schedules need a valid time range.';
      }
    }
    if (form.schedule_type === 'date_specific') {
      const startIso = toUtcIso(form.start_at_utc);
      const endIso = toUtcIso(form.end_at_utc);
      if (!startIso || !endIso) {
        return 'Date-specific schedules need start and end time.';
      }
      if (new Date(startIso) >= new Date(endIso)) {
        return 'Date-specific schedules need a valid time range.';
      }
    }
    return null;
  };

  const formToPayload = (form: ScheduleFormState) => ({
    activity_id: form.activity_id,
    location_id: form.location_id,
    schedule_type: form.schedule_type,
    day_of_week_utc: parseOptionalNumber(form.day_of_week_utc),
    day_of_month: parseOptionalNumber(form.day_of_month),
    start_minutes_utc: parseOptionalNumber(form.start_minutes_utc),
    end_minutes_utc: parseOptionalNumber(form.end_minutes_utc),
    start_at_utc: toUtcIso(form.start_at_utc),
    end_at_utc: toUtcIso(form.end_at_utc),
    languages: parseLanguages(form.languages),
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  const scheduleType = panel.formState.schedule_type;

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const activityName = activities.find((a) => a.id === item.activity_id)?.name?.toLowerCase() || '';
    const locationName = locations.find((l) => l.id === item.location_id)?.district?.toLowerCase() || '';
    const languagesStr = item.languages?.join(', ')?.toLowerCase() || '';
    return (
      activityName.includes(query) ||
      locationName.includes(query) ||
      item.schedule_type?.toLowerCase().includes(query) ||
      languagesStr.includes(query)
    );
  });

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
          <div>
            <Label htmlFor='schedule-activity'>Activity</Label>
            <Select
              id='schedule-activity'
              value={panel.formState.activity_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  activity_id: e.target.value,
                }))
              }
            >
              <option value=''>Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='schedule-location'>Location</Label>
            <Select
              id='schedule-location'
              value={panel.formState.location_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  location_id: e.target.value,
                }))
              }
            >
              <option value=''>Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.district}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='schedule-type'>Schedule Type</Label>
            <Select
              id='schedule-type'
              value={panel.formState.schedule_type}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  schedule_type: e.target.value,
                  day_of_week_utc: '',
                  day_of_month: '',
                  start_minutes_utc: '',
                  end_minutes_utc: '',
                  start_at_utc: '',
                  end_at_utc: '',
                }))
              }
            >
              {scheduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          {scheduleType === 'weekly' && (
            <>
              <div>
                <Label htmlFor='schedule-day'>Day of Week (0-6)</Label>
                <Input
                  id='schedule-day'
                  type='number'
                  min='0'
                  max='6'
                  value={panel.formState.day_of_week_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      day_of_week_utc: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor='schedule-start'>Start Minutes (UTC)</Label>
                <Input
                  id='schedule-start'
                  type='number'
                  min='0'
                  max='1439'
                  value={panel.formState.start_minutes_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      start_minutes_utc: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor='schedule-end'>End Minutes (UTC)</Label>
                <Input
                  id='schedule-end'
                  type='number'
                  min='0'
                  max='1439'
                  value={panel.formState.end_minutes_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      end_minutes_utc: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          {scheduleType === 'monthly' && (
            <>
              <div>
                <Label htmlFor='schedule-month-day'>Day of Month (1-31)</Label>
                <Input
                  id='schedule-month-day'
                  type='number'
                  min='1'
                  max='31'
                  value={panel.formState.day_of_month}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      day_of_month: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor='schedule-month-start'>Start Minutes (UTC)</Label>
                <Input
                  id='schedule-month-start'
                  type='number'
                  min='0'
                  max='1439'
                  value={panel.formState.start_minutes_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      start_minutes_utc: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor='schedule-month-end'>End Minutes (UTC)</Label>
                <Input
                  id='schedule-month-end'
                  type='number'
                  min='0'
                  max='1439'
                  value={panel.formState.end_minutes_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      end_minutes_utc: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          {scheduleType === 'date_specific' && (
            <>
              <div>
                <Label htmlFor='schedule-start-at'>Start (UTC)</Label>
                <Input
                  id='schedule-start-at'
                  type='datetime-local'
                  value={panel.formState.start_at_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      start_at_utc: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor='schedule-end-at'>End (UTC)</Label>
                <Input
                  id='schedule-end-at'
                  type='datetime-local'
                  value={panel.formState.end_at_utc}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      end_at_utc: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          <div className='md:col-span-2'>
            <Label htmlFor='schedule-languages'>Languages (comma-separated)</Label>
            <Input
              id='schedule-languages'
              value={panel.formState.languages}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  languages: e.target.value,
                }))
              }
            />
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
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>No schedules match your search.</p>
            ) : (
            <>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto md:block'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Activity</th>
                  <th className='py-2'>Location</th>
                  <th className='py-2'>Type</th>
                  <th className='py-2'>Languages</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const activityName =
                    activities.find((a) => a.id === item.activity_id)?.name ||
                    item.activity_id;
                  const locationName =
                    locations.find((l) => l.id === item.location_id)?.district ||
                    item.location_id;
                  return (
                    <tr key={item.id} className='border-b border-slate-100'>
                      <td className='py-2 font-medium'>{activityName}</td>
                      <td className='py-2 text-slate-600'>{locationName}</td>
                      <td className='py-2 text-slate-600'>{item.schedule_type}</td>
                      <td className='py-2 text-slate-600'>
                        {item.languages?.length
                          ? item.languages.join(', ')
                          : '—'}
                      </td>
                      <td className='py-2 text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            onClick={() => panel.startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='danger'
                            onClick={() =>
                              panel.handleDelete({ ...item, name: activityName })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile card view */}
            <div className='space-y-3 md:hidden'>
              {filteredItems.map((item) => {
                const activityName =
                  activities.find((a) => a.id === item.activity_id)?.name ||
                  item.activity_id;
                const locationName =
                  locations.find((l) => l.id === item.location_id)?.district ||
                  item.location_id;
                return (
                  <div
                    key={item.id}
                    className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='font-medium text-slate-900'>{activityName}</div>
                    <div className='mt-1 text-sm text-slate-600'>{locationName}</div>
                    <div className='mt-2 space-y-1 text-sm'>
                      <div className='flex justify-between'>
                        <span className='text-slate-500'>Type:</span>
                        <span className='text-slate-700'>{item.schedule_type}</span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-slate-500'>Languages:</span>
                        <span className='text-slate-700'>
                          {item.languages?.length ? item.languages.join(', ') : '—'}
                        </span>
                      </div>
                    </div>
                    <div className='mt-3 flex gap-2 border-t border-slate-200 pt-3'>
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        onClick={() => panel.startEdit(item)}
                        className='flex-1'
                      >
                        Edit
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={() =>
                          panel.handleDelete({ ...item, name: activityName })
                        }
                        className='flex-1'
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {panel.nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={panel.loadMore}
                  className='w-full sm:w-auto'
                >
                  Load more
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
