'use client';

import { useEffect, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import { ApiError, listCognitoUsers } from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { CognitoUser, Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface OrganizationFormState {
  name: string;
  description: string;
  owner_id: string;
}

const emptyForm: OrganizationFormState = {
  name: '',
  description: '',
  owner_id: '',
};

function itemToForm(item: Organization): OrganizationFormState {
  return {
    name: item.name ?? '',
    description: item.description ?? '',
    owner_id: item.owner_id ?? '',
  };
}

function getOwnerDisplayName(ownerId: string, users: CognitoUser[]): string {
  const user = users.find((u) => u.sub === ownerId);
  if (!user) {
    return ownerId.slice(0, 8) + '...';
  }
  return user.email || user.username || user.sub.slice(0, 8) + '...';
}

interface OrganizationsPanelProps {
  mode: ApiMode;
}

export function OrganizationsPanel({ mode }: OrganizationsPanelProps) {
  const isAdmin = mode === 'admin';
  const panel = useResourcePanel<Organization, OrganizationFormState>(
    'organizations',
    mode,
    emptyForm,
    itemToForm
  );

  // Admin-only: Load Cognito users for owner selection
  const [cognitoUsers, setCognitoUsers] = useState<CognitoUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(isAdmin);

  // Extract setError for stable reference in useEffect
  const { setError } = panel;

  useEffect(() => {
    if (!isAdmin) return;

    const loadCognitoUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const allUsers: CognitoUser[] = [];
        let paginationToken: string | undefined;

        do {
          const response = await listCognitoUsers(paginationToken, 60);
          allUsers.push(...response.items);
          paginationToken = response.pagination_token ?? undefined;
        } while (paginationToken);

        setCognitoUsers(allUsers);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to load users for owner selection.';
        setError(message);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadCognitoUsers();
  }, [isAdmin, setError]);

  const validate = () => {
    if (!panel.formState.name.trim()) {
      return 'Name is required.';
    }
    if (isAdmin && !panel.formState.owner_id) {
      return 'Owner is required.';
    }
    return null;
  };

  const formToPayload = (form: OrganizationFormState) => {
    const existingOrg = panel.items.find((item) => item.id === panel.editingId);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      media_urls: existingOrg?.media_urls ?? [],
    };
    if (isAdmin) {
      payload.owner_id = form.owner_id;
    }
    return payload;
  };

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  // Owner mode: Don't show create form, only edit
  const showCreateForm = isAdmin || panel.editingId;
  const canCreate = isAdmin;

  return (
    <div className='space-y-6'>
      {showCreateForm && (
        <Card
          title={panel.editingId ? 'Edit Organization' : 'New Organization'}
          description={
            isAdmin
              ? 'Create and manage organizations. Use the Media section to add images.'
              : 'Update your organization details.'
          }
        >
          {panel.error && (
            <div className='mb-4'>
              <StatusBanner variant='error' title='Error'>
                {panel.error}
              </StatusBanner>
            </div>
          )}
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <Label htmlFor='org-name'>Name</Label>
              <Input
                id='org-name'
                value={panel.formState.name}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
            </div>
            {isAdmin && (
              <div>
                <Label htmlFor='org-owner'>Owner</Label>
                <Select
                  id='org-owner'
                  value={panel.formState.owner_id}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      owner_id: e.target.value,
                    }))
                  }
                  disabled={isLoadingUsers}
                >
                  <option value=''>
                    {isLoadingUsers ? 'Loading users...' : 'Select an owner'}
                  </option>
                  {cognitoUsers.map((user) => (
                    <option key={user.sub} value={user.sub}>
                      {user.email || user.username || user.sub}
                      {user.name ? ` (${user.name})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className={isAdmin ? 'md:col-span-2' : ''}>
              <Label htmlFor='org-description'>Description</Label>
              <Textarea
                id='org-description'
                rows={3}
                value={panel.formState.description}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    description: e.target.value,
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
              {panel.editingId ? 'Update Organization' : 'Add Organization'}
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
      )}

      <Card
        title={isAdmin ? 'Existing Organizations' : 'Your Organizations'}
        description={
          isAdmin
            ? 'Select an organization to edit or delete.'
            : 'Organizations you own and manage.'
        }
      >
        {!showCreateForm && panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading organizations...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            {isAdmin
              ? 'No organizations yet.'
              : 'You do not own any organizations yet.'}
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Name</th>
                  {isAdmin && <th className='py-2'>Owner</th>}
                  <th className='py-2'>Description</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {panel.items.map((item) => (
                  <tr key={item.id} className='border-b border-slate-100'>
                    <td className='py-2 font-medium'>{item.name}</td>
                    {isAdmin && (
                      <td className='py-2 text-slate-600'>
                        {getOwnerDisplayName(item.owner_id, cognitoUsers)}
                      </td>
                    )}
                    <td className='py-2 text-slate-600'>
                      {item.description || '—'}
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
                          onClick={() => panel.handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {panel.nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={panel.loadMore}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
