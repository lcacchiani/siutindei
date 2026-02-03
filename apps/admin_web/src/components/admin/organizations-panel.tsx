'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  createResource,
  deleteResource,
  listCognitoUsers,
  listResource,
  updateResource,
} from '../../lib/api-client';
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

function getOwnerDisplayName(
  ownerId: string,
  users: CognitoUser[]
): string {
  const user = users.find((u) => u.sub === ownerId);
  if (!user) {
    return ownerId.slice(0, 8) + '...';
  }
  return user.email || user.username || user.sub.slice(0, 8) + '...';
}

const emptyForm: OrganizationFormState = {
  name: '',
  description: '',
  owner_id: '',
};

export function OrganizationsPanel() {
  const [items, setItems] = useState<Organization[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cognitoUsers, setCognitoUsers] = useState<CognitoUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const loadItems = async (cursor?: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await listResource<Organization>(
        'organizations',
        cursor
      );
      setItems((prev) =>
        cursor ? [...prev, ...response.items] : response.items
      );
      setNextCursor(response.next_cursor ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load organizations.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCognitoUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers: CognitoUser[] = [];
      let paginationToken: string | undefined;

      // Load all users (paginated)
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

  useEffect(() => {
    loadItems();
    loadCognitoUsers();
  }, []);

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!formState.owner_id) {
      setError('Owner is required.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        owner_id: formState.owner_id,
      };
      if (editingId) {
        // Preserve existing picture_urls when updating
        const existingOrg = items.find((item) => item.id === editingId);
        const payloadWithPictures = {
          ...payload,
          picture_urls: existingOrg?.picture_urls ?? [],
        };
        const updated = await updateResource<
          typeof payloadWithPictures,
          Organization
        >('organizations', editingId, payloadWithPictures);
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingId ? updated : item
          )
        );
      } else {
        const payloadWithPictures = {
          ...payload,
          picture_urls: [],
        };
        const created = await createResource<
          typeof payloadWithPictures,
          Organization
        >('organizations', payloadWithPictures);
        setItems((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to save organization.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: Organization) => {
    setEditingId(item.id);
    setFormState({
      name: item.name ?? '',
      description: item.description ?? '',
      owner_id: item.owner_id ?? '',
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
    try {
      await deleteResource('organizations', item.id);
      setItems((prev) =>
        prev.filter((entry) => entry.id !== item.id)
      );
      if (editingId === item.id) {
        resetForm();
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to delete organization.';
      setError(message);
    }
  };

  return (
    <div className='space-y-6'>
      <Card
        title='Organizations'
        description='Create and manage organizations. Use the Pictures section to add images.'
      >
        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='org-name'>Name</Label>
            <Input
              id='org-name'
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='org-owner'>Owner</Label>
            <Select
              id='org-owner'
              value={formState.owner_id}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  owner_id: event.target.value,
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
          <div className='md:col-span-2'>
            <Label htmlFor='org-description'>Description</Label>
            <Textarea
              id='org-description'
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
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {editingId ? 'Update organization' : 'Add organization'}
          </Button>
          {editingId && (
            <Button
              type='button'
              variant='secondary'
              onClick={resetForm}
              disabled={isSaving}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </Card>
      <Card
        title='Existing organizations'
        description='Select an organization to edit or delete.'
      >
        {isLoading ? (
          <p className='text-sm text-slate-600'>Loading organizations...</p>
        ) : items.length === 0 ? (
          <p className='text-sm text-slate-600'>No organizations yet.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Name</th>
                  <th className='py-2'>Owner</th>
                  <th className='py-2'>Description</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className='border-b border-slate-100'
                  >
                    <td className='py-2 font-medium'>{item.name}</td>
                    <td className='py-2 text-slate-600'>
                      {getOwnerDisplayName(item.owner_id, cognitoUsers)}
                    </td>
                    <td className='py-2 text-slate-600'>
                      {item.description || '—'}
                    </td>
                    <td className='py-2 text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
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
            {nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => loadItems(nextCursor)}
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
