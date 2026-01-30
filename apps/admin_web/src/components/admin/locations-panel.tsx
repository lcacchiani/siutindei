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
import type { Location, Organization } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatusBanner } from '@/components/status-banner';

const emptyForm = {
  org_id: '',
  district: '',
  address: '',
  lat: '',
  lng: '',
};

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LocationsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'options'],
    queryFn: () => listResource<Organization>('organizations', undefined, 200),
  });

  const locationsQuery = useInfiniteQuery({
    queryKey: ['locations'],
    queryFn: ({ pageParam }) =>
      listResource<Location>('locations', pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const items = useMemo(() => {
    return locationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [locationsQuery.data]);

  const organizations = organizationsQuery.data?.items ?? [];

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.org_id || !formState.district.trim()) {
      setError('Organization and district are required.');
      return;
    }
    setError('');
    const payload = {
      org_id: formState.org_id,
      district: formState.district.trim(),
      address: formState.address.trim() || null,
      lat: parseOptionalNumber(formState.lat),
      lng: parseOptionalNumber(formState.lng),
    };
    saveMutation.mutate(payload);
  };

  const startEdit = (item: Location) => {
    setEditingId(item.id);
    setFormState({
      org_id: item.org_id ?? '',
      district: item.district ?? '',
      address: item.address ?? '',
      lat:
        item.lat !== undefined && item.lat !== null ? `${item.lat}` : '',
      lng:
        item.lng !== undefined && item.lng !== null ? `${item.lng}` : '',
    });
  };

  const handleDelete = async (item: Location) => {
    const confirmed = window.confirm(
      `Delete location ${item.district}? This cannot be undone.`
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
      district: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
    }) => {
      if (editingId) {
        return updateResource<typeof payload, Location>(
          'locations',
          editingId,
          payload
        );
      }
      return createResource<typeof payload, Location>('locations', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      resetForm();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save location.';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource('locations', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      if (editingId) {
        resetForm();
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to delete location.';
      setError(message);
    },
  });

  const listError =
    locationsQuery.error instanceof ApiError
      ? locationsQuery.error.message
      : locationsQuery.error
        ? 'Failed to load locations.'
        : '';
  const orgError =
    organizationsQuery.error instanceof ApiError
      ? organizationsQuery.error.message
      : organizationsQuery.error
        ? 'Failed to load organizations.'
        : '';
  const errorMessage = error || listError || orgError;
  const isSaving = saveMutation.isPending;
  const isLoading = locationsQuery.isLoading;
  const hasNextPage = locationsQuery.hasNextPage;

  return (
    <div className="d-grid gap-4">
      <Card title="Locations" description="Manage location entries.">
        {errorMessage && (
          <div className="mb-3">
            <StatusBanner variant="error" title="Error">
              {errorMessage}
            </StatusBanner>
          </div>
        )}
        <div className="row g-3">
          <div className="col-md-6">
            <Label htmlFor="location-org">Organization</Label>
            <Select
              id="location-org"
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
            <Label htmlFor="location-district">District</Label>
            <Input
              id="location-district"
              value={formState.district}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  district: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-12">
            <Label htmlFor="location-address">Address</Label>
            <Input
              id="location-address"
              value={formState.address}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="location-lat">Latitude</Label>
            <Input
              id="location-lat"
              type="number"
              step="0.000001"
              value={formState.lat}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  lat: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="location-lng">Longitude</Label>
            <Input
              id="location-lng"
              type="number"
              step="0.000001"
              value={formState.lng}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  lng: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {editingId ? 'Update location' : 'Add location'}
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
        title="Existing locations"
        description="Select a location to edit or delete."
      >
        {isLoading ? (
          <p className="text-muted small mb-0">Loading locations...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">No locations yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>District</th>
                  <th>Organization</th>
                  <th>Address</th>
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
                      <td className="fw-semibold">{item.district}</td>
                      <td className="text-muted">{orgName}</td>
                      <td className="text-muted">{item.address || '—'}</td>
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
                  onClick={() => locationsQuery.fetchNextPage()}
                  disabled={locationsQuery.isFetchingNextPage}
                >
                  {locationsQuery.isFetchingNextPage
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
