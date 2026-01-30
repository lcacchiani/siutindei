import { useMemo, useState } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ApiError,
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from '@/lib/api-client';
import type { Activity, ActivitySchedule, Location } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatusBanner } from '@/components/status-banner';

const emptyForm = {
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

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUtcInputValue(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (part: number) => `${part}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function toUtcIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(`${trimmed}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseLanguages(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function SchedulesPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activitiesQuery = useQuery({
    queryKey: ['activities', 'options'],
    queryFn: () => listResource<Activity>('activities', undefined, 200),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'options'],
    queryFn: () => listResource<Location>('locations', undefined, 200),
  });

  const schedulesQuery = useInfiniteQuery({
    queryKey: ['schedules'],
    queryFn: ({ pageParam }) =>
      listResource<ActivitySchedule>('schedules', pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const items = useMemo(() => {
    return schedulesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [schedulesQuery.data]);

  const activities = activitiesQuery.data?.items ?? [];
  const locations = locationsQuery.data?.items ?? [];

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const validateSchedule = () => {
    if (!formState.activity_id || !formState.location_id) {
      return 'Activity and location are required.';
    }
    if (formState.schedule_type === 'weekly') {
      const dayOfWeek = parseOptionalNumber(formState.day_of_week_utc);
      const startMinutes = parseOptionalNumber(formState.start_minutes_utc);
      const endMinutes = parseOptionalNumber(formState.end_minutes_utc);
      if (dayOfWeek === null || startMinutes === null || endMinutes === null) {
        return 'Weekly schedules need day and time range.';
      }
      if (startMinutes >= endMinutes) {
        return 'Weekly schedules need a valid time range.';
      }
    }
    if (formState.schedule_type === 'monthly') {
      const dayOfMonth = parseOptionalNumber(formState.day_of_month);
      const startMinutes = parseOptionalNumber(formState.start_minutes_utc);
      const endMinutes = parseOptionalNumber(formState.end_minutes_utc);
      if (dayOfMonth === null || startMinutes === null || endMinutes === null) {
        return 'Monthly schedules need day of month and time range.';
      }
      if (startMinutes >= endMinutes) {
        return 'Monthly schedules need a valid time range.';
      }
    }
    if (formState.schedule_type === 'date_specific') {
      const startIso = toUtcIso(formState.start_at_utc);
      const endIso = toUtcIso(formState.end_at_utc);
      if (!startIso || !endIso) {
        return 'Date-specific schedules need start and end time.';
      }
      if (new Date(startIso) >= new Date(endIso)) {
        return 'Date-specific schedules need a valid time range.';
      }
    }
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validateSchedule();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    const payload = {
      activity_id: formState.activity_id,
      location_id: formState.location_id,
      schedule_type: formState.schedule_type,
      day_of_week_utc: parseOptionalNumber(formState.day_of_week_utc),
      day_of_month: parseOptionalNumber(formState.day_of_month),
      start_minutes_utc: parseOptionalNumber(formState.start_minutes_utc),
      end_minutes_utc: parseOptionalNumber(formState.end_minutes_utc),
      start_at_utc: toUtcIso(formState.start_at_utc),
      end_at_utc: toUtcIso(formState.end_at_utc),
      languages: parseLanguages(formState.languages),
    };
    saveMutation.mutate(payload);
  };

  const startEdit = (item: ActivitySchedule) => {
    setEditingId(item.id);
    setFormState({
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
    });
  };

  const handleDelete = async (item: ActivitySchedule) => {
    const confirmed = window.confirm(
      'Delete this schedule entry? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }
    setError('');
    deleteMutation.mutate(item.id);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      activity_id: string;
      location_id: string;
      schedule_type: string;
      day_of_week_utc: number | null;
      day_of_month: number | null;
      start_minutes_utc: number | null;
      end_minutes_utc: number | null;
      start_at_utc: string | null;
      end_at_utc: string | null;
      languages: string[];
    }) => {
      if (editingId) {
        return updateResource<typeof payload, ActivitySchedule>(
          'schedules',
          editingId,
          payload
        );
      }
      return createResource<typeof payload, ActivitySchedule>(
        'schedules',
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      resetForm();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save schedule.';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource('schedules', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      if (editingId) {
        resetForm();
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to delete schedule.';
      setError(message);
    },
  });

  const listError =
    schedulesQuery.error instanceof ApiError
      ? schedulesQuery.error.message
      : schedulesQuery.error
        ? 'Failed to load schedules.'
        : '';
  const referenceError =
    activitiesQuery.error || locationsQuery.error
      ? 'Failed to load reference data.'
      : '';
  const errorMessage = error || listError || referenceError;
  const isSaving = saveMutation.isPending;
  const isLoading = schedulesQuery.isLoading;
  const hasNextPage = schedulesQuery.hasNextPage;
  const scheduleType = formState.schedule_type;

  return (
    <div className="d-grid gap-4">
      <Card title="Schedules" description="Manage schedule entries.">
        {errorMessage && (
          <div className="mb-3">
            <StatusBanner variant="error" title="Error">
              {errorMessage}
            </StatusBanner>
          </div>
        )}
        <div className="row g-3">
          <div className="col-md-6">
            <Label htmlFor="schedule-activity">Activity</Label>
            <Select
              id="schedule-activity"
              value={formState.activity_id}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  activity_id: event.target.value,
                }))
              }
            >
              <option value="">Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-md-6">
            <Label htmlFor="schedule-location">Location</Label>
            <Select
              id="schedule-location"
              value={formState.location_id}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  location_id: event.target.value,
                }))
              }
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.district}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-md-6">
            <Label htmlFor="schedule-type">Schedule type</Label>
            <Select
              id="schedule-type"
              value={formState.schedule_type}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  schedule_type: event.target.value,
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
              <div className="col-md-6">
                <Label htmlFor="schedule-day">Day of week (0-6)</Label>
                <Input
                  id="schedule-day"
                  type="number"
                  min="0"
                  max="6"
                  value={formState.day_of_week_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      day_of_week_utc: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="schedule-start">Start minutes (UTC)</Label>
                <Input
                  id="schedule-start"
                  type="number"
                  min="0"
                  max="1439"
                  value={formState.start_minutes_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      start_minutes_utc: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="schedule-end">End minutes (UTC)</Label>
                <Input
                  id="schedule-end"
                  type="number"
                  min="0"
                  max="1439"
                  value={formState.end_minutes_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      end_minutes_utc: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          {scheduleType === 'monthly' && (
            <>
              <div className="col-md-6">
                <Label htmlFor="schedule-month-day">Day of month (1-31)</Label>
                <Input
                  id="schedule-month-day"
                  type="number"
                  min="1"
                  max="31"
                  value={formState.day_of_month}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      day_of_month: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="schedule-month-start">
                  Start minutes (UTC)
                </Label>
                <Input
                  id="schedule-month-start"
                  type="number"
                  min="0"
                  max="1439"
                  value={formState.start_minutes_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      start_minutes_utc: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="schedule-month-end">End minutes (UTC)</Label>
                <Input
                  id="schedule-month-end"
                  type="number"
                  min="0"
                  max="1439"
                  value={formState.end_minutes_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      end_minutes_utc: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          {scheduleType === 'date_specific' && (
            <>
              <div className="col-md-6">
                <Label htmlFor="schedule-start-at">Start (UTC)</Label>
                <Input
                  id="schedule-start-at"
                  type="datetime-local"
                  value={formState.start_at_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      start_at_utc: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="schedule-end-at">End (UTC)</Label>
                <Input
                  id="schedule-end-at"
                  type="datetime-local"
                  value={formState.end_at_utc}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      end_at_utc: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
          <div className="col-12">
            <Label htmlFor="schedule-languages">
              Languages (comma-separated)
            </Label>
            <Input
              id="schedule-languages"
              value={formState.languages}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  languages: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {editingId ? 'Update schedule' : 'Add schedule'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={isSaving}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </Card>
      <Card
        title="Existing schedules"
        description="Select a schedule to edit or delete."
      >
        {isLoading ? (
          <p className="text-muted small mb-0">Loading schedules...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">No schedules yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Activity</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Languages</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const activityName =
                    activities.find(
                      (activity) => activity.id === item.activity_id
                    )?.name || item.activity_id;
                  const locationName =
                    locations.find(
                      (location) => location.id === item.location_id
                    )?.district || item.location_id;
                  return (
                    <tr key={item.id}>
                      <td className="fw-semibold">{activityName}</td>
                      <td className="text-muted">{locationName}</td>
                      <td className="text-muted">{item.schedule_type}</td>
                      <td className="text-muted">
                        {item.languages?.length
                          ? item.languages.join(', ')
                          : '—'}
                      </td>
                      <td className="text-end table-actions">
                        <div className="btn-group btn-group-sm">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(item)}
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
            {hasNextPage && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => schedulesQuery.fetchNextPage()}
                  disabled={schedulesQuery.isFetchingNextPage}
                >
                  {schedulesQuery.isFetchingNextPage
                    ? 'Loading...'
                    : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
