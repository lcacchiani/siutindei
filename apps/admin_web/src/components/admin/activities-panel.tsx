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
import type { Activity, Organization } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBanner } from '@/components/status-banner';

const emptyForm = {
  org_id: '',
  name: '',
  description: '',
  age_min: '',
  age_max: '',
};

function parseRequiredNumber(value: string) {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ActivitiesPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'options'],
    queryFn: () => listResource<Organization>('organizations', undefined, 200),
  });

  const activitiesQuery = useInfiniteQuery({
    queryKey: ['activities'],
    queryFn: ({ pageParam }) =>
      listResource<Activity>('activities', pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const items = useMemo(() => {
    return activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [activitiesQuery.data]);

  const organizations = organizationsQuery.data?.items ?? [];

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const ageMin = parseRequiredNumber(formState.age_min);
    const ageMax = parseRequiredNumber(formState.age_max);
    if (!formState.org_id || !formState.name.trim()) {
      setError('Organization and name are required.');
      return;
    }
    if (ageMin === null || ageMax === null) {
      setError('Age range must be numeric.');
      return;
    }
    if (ageMin >= ageMax) {
      setError('Age min must be less than age max.');
      return;
    }
    setError('');
    const payload = {
      org_id: formState.org_id,
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      age_min: ageMin,
      age_max: ageMax,
    };
    saveMutation.mutate(payload);
  };

  const startEdit = (item: Activity) => {
    setEditingId(item.id);
    setFormState({
      org_id: item.org_id ?? '',
      name: item.name ?? '',
      description: item.description ?? '',
      age_min: item.age_min !== undefined ? `${item.age_min}` : '',
      age_max: item.age_max !== undefined ? `${item.age_max}` : '',
    });
  };

  const handleDelete = async (item: Activity) => {
    const confirmed = window.confirm(
      `Delete activity ${item.name}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setError('');
    deleteMutation.mutate(item.id);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      org_id: string;
      name: string;
      description: string | null;
      age_min: number;
      age_max: number;
    }) => {
      if (editingId) {
        return updateResource<typeof payload, Activity>(
          'activities',
          editingId,
          payload
        );
      }
      return createResource<typeof payload, Activity>('activities', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      resetForm();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save activity.';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource('activities', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      if (editingId) {
        resetForm();
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to delete activity.';
      setError(message);
    },
  });

  const listError =
    activitiesQuery.error instanceof ApiError
      ? activitiesQuery.error.message
      : activitiesQuery.error
        ? 'Failed to load activities.'
        : '';
  const orgError =
    organizationsQuery.error instanceof ApiError
      ? organizationsQuery.error.message
      : organizationsQuery.error
        ? 'Failed to load organizations.'
        : '';
  const errorMessage = error || listError || orgError;
  const isSaving = saveMutation.isPending;
  const isLoading = activitiesQuery.isLoading;
  const hasNextPage = activitiesQuery.hasNextPage;

  return (
    <div className="d-grid gap-4">
      <Card title="Activities" description="Manage activity entries.">
        {errorMessage && (
          <div className="mb-3">
            <StatusBanner variant="error" title="Error">
              {errorMessage}
            </StatusBanner>
          </div>
        )}
        <div className="row g-3">
          <div className="col-md-6">
            <Label htmlFor="activity-org">Organization</Label>
            <Select
              id="activity-org"
              value={formState.org_id}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  org_id: event.target.value,
                }))
              }
            >
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-md-6">
            <Label htmlFor="activity-name">Name</Label>
            <Input
              id="activity-name"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-12">
            <Label htmlFor="activity-description">Description</Label>
            <Textarea
              id="activity-description"
              rows={3}
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="activity-age-min">Age min</Label>
            <Input
              id="activity-age-min"
              type="number"
              min="0"
              value={formState.age_min}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  age_min: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="activity-age-max">Age max</Label>
            <Input
              id="activity-age-max"
              type="number"
              min="0"
              value={formState.age_max}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  age_max: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {editingId ? 'Update activity' : 'Add activity'}
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
        title="Existing activities"
        description="Select an activity to edit or delete."
      >
        {isLoading ? (
          <p className="text-muted small mb-0">Loading activities...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">No activities yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Age range</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const orgName =
                    organizations.find((org) => org.id === item.org_id)
                      ?.name || item.org_id;
                  return (
                    <tr key={item.id}>
                      <td className="fw-semibold">{item.name}</td>
                      <td className="text-muted">{orgName}</td>
                      <td className="text-muted">
                        {item.age_min} - {item.age_max}
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
                  onClick={() => activitiesQuery.fetchNextPage()}
                  disabled={activitiesQuery.isFetchingNextPage}
                >
                  {activitiesQuery.isFetchingNextPage
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
