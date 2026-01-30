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
import type { Activity, ActivityPricing, Location } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatusBanner } from '@/components/status-banner';

const emptyForm = {
  activity_id: '',
  location_id: '',
  pricing_type: 'per_class',
  amount: '',
  currency: 'HKD',
  sessions_count: '',
};

const pricingOptions = [
  { value: 'per_class', label: 'Per class' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_sessions', label: 'Per sessions' },
];

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PricingPanel() {
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

  const pricingQuery = useInfiniteQuery({
    queryKey: ['pricing'],
    queryFn: ({ pageParam }) =>
      listResource<ActivityPricing>('pricing', pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const items = useMemo(() => {
    return pricingQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [pricingQuery.data]);

  const activities = activitiesQuery.data?.items ?? [];
  const locations = locationsQuery.data?.items ?? [];

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.activity_id || !formState.location_id) {
      setError('Activity and location are required.');
      return;
    }
    if (!formState.amount.trim()) {
      setError('Amount is required.');
      return;
    }
    const amountValue = Number(formState.amount);
    if (!Number.isFinite(amountValue)) {
      setError('Amount must be numeric.');
      return;
    }
    const sessionsCount = parseOptionalNumber(formState.sessions_count);
    if (formState.pricing_type === 'per_sessions') {
      if (sessionsCount === null || sessionsCount <= 0) {
        setError('Sessions count is required for per-sessions pricing.');
        return;
      }
    }
    setError('');
    const payload = {
      activity_id: formState.activity_id,
      location_id: formState.location_id,
      pricing_type: formState.pricing_type,
      amount: formState.amount.trim(),
      currency: formState.currency.trim() || 'HKD',
      sessions_count:
        formState.pricing_type === 'per_sessions' ? sessionsCount : null,
    };
    saveMutation.mutate(payload);
  };

  const startEdit = (item: ActivityPricing) => {
    setEditingId(item.id);
    setFormState({
      activity_id: item.activity_id ?? '',
      location_id: item.location_id ?? '',
      pricing_type: item.pricing_type,
      amount: item.amount ?? '',
      currency: item.currency ?? 'HKD',
      sessions_count: item.sessions_count ? `${item.sessions_count}` : '',
    });
  };

  const handleDelete = async (item: ActivityPricing) => {
    const confirmed = window.confirm(
      'Delete this pricing entry? This cannot be undone.'
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
      pricing_type: string;
      amount: string;
      currency: string;
      sessions_count: number | null;
    }) => {
      if (editingId) {
        return updateResource<typeof payload, ActivityPricing>(
          'pricing',
          editingId,
          payload
        );
      }
      return createResource<typeof payload, ActivityPricing>(
        'pricing',
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      resetForm();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save pricing.';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource('pricing', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      if (editingId) {
        resetForm();
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to delete pricing.';
      setError(message);
    },
  });

  const listError =
    pricingQuery.error instanceof ApiError
      ? pricingQuery.error.message
      : pricingQuery.error
        ? 'Failed to load pricing.'
        : '';
  const referenceError =
    activitiesQuery.error || locationsQuery.error
      ? 'Failed to load reference data.'
      : '';
  const errorMessage = error || listError || referenceError;
  const isSaving = saveMutation.isPending;
  const isLoading = pricingQuery.isLoading;
  const hasNextPage = pricingQuery.hasNextPage;
  const showSessionsField = formState.pricing_type === 'per_sessions';

  return (
    <div className="d-grid gap-4">
      <Card title="Pricing" description="Manage pricing entries.">
        {errorMessage && (
          <div className="mb-3">
            <StatusBanner variant="error" title="Error">
              {errorMessage}
            </StatusBanner>
          </div>
        )}
        <div className="row g-3">
          <div className="col-md-6">
            <Label htmlFor="pricing-activity">Activity</Label>
            <Select
              id="pricing-activity"
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
            <Label htmlFor="pricing-location">Location</Label>
            <Select
              id="pricing-location"
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
            <Label htmlFor="pricing-type">Pricing type</Label>
            <Select
              id="pricing-type"
              value={formState.pricing_type}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  pricing_type: event.target.value,
                  sessions_count:
                    event.target.value === 'per_sessions'
                      ? prev.sessions_count
                      : '',
                }))
              }
            >
              {pricingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-md-6">
            <Label htmlFor="pricing-amount">Amount</Label>
            <Input
              id="pricing-amount"
              type="number"
              step="0.01"
              value={formState.amount}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="pricing-currency">Currency</Label>
            <Input
              id="pricing-currency"
              value={formState.currency}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  currency: event.target.value,
                }))
              }
            />
          </div>
          {showSessionsField && (
            <div className="col-md-6">
              <Label htmlFor="pricing-sessions">Sessions count</Label>
              <Input
                id="pricing-sessions"
                type="number"
                min="1"
                value={formState.sessions_count}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    sessions_count: event.target.value,
                  }))
                }
              />
            </div>
          )}
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {editingId ? 'Update pricing' : 'Add pricing'}
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
        title="Existing pricing"
        description="Select a pricing entry to edit or delete."
      >
        {isLoading ? (
          <p className="text-muted small mb-0">Loading pricing...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">No pricing entries yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Activity</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Amount</th>
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
                      <td className="text-muted">{item.pricing_type}</td>
                      <td className="text-muted">
                        {item.amount} {item.currency}
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
                  onClick={() => pricingQuery.fetchNextPage()}
                  disabled={pricingQuery.isFetchingNextPage}
                >
                  {pricingQuery.isFetchingNextPage
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
