import { useMemo, useState } from 'react';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ApiError,
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from '@/lib/api-client';
import type { Organization } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBanner } from '@/components/status-banner';

const emptyForm = {
  name: '',
  description: '',
};

export function OrganizationsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const organizationsQuery = useInfiniteQuery({
    queryKey: ['organizations'],
    queryFn: ({ pageParam }) =>
      listResource<Organization>('organizations', pageParam ?? undefined),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const items = useMemo(() => {
    return organizationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [organizationsQuery.data]);

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.name.trim()) {
      setError('Name is required.');
      return;
    }
    setError('');
    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
    };
    saveMutation.mutate(payload);
  };

  const startEdit = (item: Organization) => {
    setEditingId(item.id);
    setFormState({
      name: item.name ?? '',
      description: item.description ?? '',
    });
  };

  const handleDelete = async (item: Organization) => {
    const confirmed = window.confirm(
      `Delete organization ${item.name}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setError('');
    deleteMutation.mutate(item.id);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description: string | null;
    }) => {
      if (editingId) {
        return updateResource<typeof payload, Organization>(
          'organizations',
          editingId,
          payload
        );
      }
      return createResource<typeof payload, Organization>(
        'organizations',
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      resetForm();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save organization.';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource('organizations', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      if (editingId) {
        resetForm();
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to delete organization.';
      setError(message);
    },
  });

  const listError =
    organizationsQuery.error instanceof ApiError
      ? organizationsQuery.error.message
      : organizationsQuery.error
        ? 'Failed to load organizations.'
        : '';
  const isSaving = saveMutation.isPending;
  const isLoading = organizationsQuery.isLoading;
  const hasNextPage = organizationsQuery.hasNextPage;

  return (
    <div className="d-grid gap-4">
      <Card
        title="Organizations"
        description="Create and manage organizations."
      >
        {(error || listError) && (
          <div className="mb-3">
            <StatusBanner variant="error" title="Error">
              {error || listError}
            </StatusBanner>
          </div>
        )}
        <div className="row g-3">
          <div className="col-md-6">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
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
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
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
        </div>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {editingId ? 'Update organization' : 'Add organization'}
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
        title="Existing organizations"
        description="Select an organization to edit or delete."
      >
        {isLoading ? (
          <p className="text-muted small mb-0">Loading organizations...</p>
        ) : items.length === 0 ? (
          <p className="text-muted small mb-0">No organizations yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-semibold">{item.name}</td>
                    <td className="text-muted">
                      {item.description || '—'}
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
                ))}
              </tbody>
            </table>
            {hasNextPage && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => organizationsQuery.fetchNextPage()}
                  disabled={organizationsQuery.isFetchingNextPage}
                >
                  {organizationsQuery.isFetchingNextPage
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
