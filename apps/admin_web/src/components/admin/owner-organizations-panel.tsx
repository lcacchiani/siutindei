'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  deleteOwnerOrganization,
  listOwnerOrganizations,
  updateOwnerOrganization,
} from '../../lib/api-client';
import type { Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface OrganizationFormState {
  name: string;
  description: string;
}

const emptyForm: OrganizationFormState = {
  name: '',
  description: '',
};

export function OwnerOrganizationsPanel() {
  const [items, setItems] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await listOwnerOrganizations();
      setItems(response.items);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load your organizations.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
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
    if (!editingId) {
      setError('No organization selected for editing.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const existingOrg = items.find((item) => item.id === editingId);
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        media_urls: existingOrg?.media_urls ?? [],
      };
      const updated = await updateOwnerOrganization(editingId, payload);
      setItems((prev) =>
        prev.map((item) => (item.id === editingId ? updated : item))
      );
      resetForm();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to update organization.';
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
    });
  };

  const handleDelete = async (item: Organization) => {
    const confirmed = window.confirm(
      `Delete organization "${item.name}"? This action cannot be undone and will delete all associated data.`
    );
    if (!confirmed) {
      return;
    }
    setError('');
    try {
      await deleteOwnerOrganization(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
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

  if (isLoading) {
    return (
      <div className='mx-auto max-w-4xl'>
        <Card title='Your Organizations'>
          <p className='text-sm text-slate-600'>Loading your organizations...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {editingId && (
        <Card
          title='Edit Organization'
          description='Update your organization details.'
        >
          {error && (
            <div className='mb-4'>
              <StatusBanner variant='error' title='Error'>
                {error}
              </StatusBanner>
            </div>
          )}
          <div className='space-y-4'>
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
            <Button type='button' onClick={handleSubmit} disabled={isSaving}>
              Update Organization
            </Button>
            <Button
              type='button'
              variant='secondary'
              onClick={resetForm}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card
        title='Your Organizations'
        description='Organizations you own and manage.'
      >
        {!editingId && error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}
        {items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            You do not own any organizations yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Name</th>
                  <th className='py-2'>Description</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className='border-b border-slate-100'>
                    <td className='py-2 font-medium'>{item.name}</td>
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
          </div>
        )}
      </Card>
    </div>
  );
}
