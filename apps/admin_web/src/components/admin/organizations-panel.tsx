'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

import {
  ApiError,
  createResource,
  deleteResource,
  listResource,
  updateResource,
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
  picture_urls: string[];
}

function normalizePictureUrls(urls: string[]) {
  const cleaned = urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return Array.from(new Set(cleaned));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Unable to read file.'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unsupported file result.'));
    };
    reader.readAsDataURL(file);
  });
}

const emptyForm: OrganizationFormState = {
  name: '',
  description: '',
  picture_urls: [],
};

export function OrganizationsPanel() {
  const [items, setItems] = useState<Organization[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPictures, setIsProcessingPictures] =
    useState(false);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPictureUrl, setNewPictureUrl] = useState('');

  const isPictureBusy = isSaving || isProcessingPictures;

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

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingId(null);
    setNewPictureUrl('');
  };

  const handleSubmit = async () => {
    if (!formState.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (isProcessingPictures) {
      setError('Please wait for picture processing to finish.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        picture_urls: normalizePictureUrls(formState.picture_urls),
      };
      if (editingId) {
        const updated = await updateResource<
          typeof payload,
          Organization
        >('organizations', editingId, payload);
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingId ? updated : item
          )
        );
      } else {
        const created = await createResource<
          typeof payload,
          Organization
        >('organizations', payload);
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
      picture_urls: item.picture_urls ?? [],
    });
    setNewPictureUrl('');
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

  const handleAddPictureUrl = () => {
    const trimmed = newPictureUrl.trim();
    if (!trimmed) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      picture_urls: normalizePictureUrls(
        [...prev.picture_urls, trimmed]
      ),
    }));
    setNewPictureUrl('');
  };

  const handlePictureFiles = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const target = event.target;
    const files = target.files;
    if (!files || files.length === 0) {
      return;
    }
    setIsProcessingPictures(true);
    setError('');
    try {
      const uploads = await Promise.all(
        Array.from(files).map((file) =>
          readFileAsDataUrl(file)
        )
      );
      setFormState((prev) => ({
        ...prev,
        picture_urls: normalizePictureUrls(
          [...prev.picture_urls, ...uploads]
        ),
      }));
    } catch (err) {
      setError('Unable to read selected picture files.');
    } finally {
      setIsProcessingPictures(false);
      target.value = '';
    }
  };

  const removePictureAt = (index: number) => {
    setFormState((prev) => {
      const nextPictures = [...prev.picture_urls];
      nextPictures.splice(index, 1);
      return { ...prev, picture_urls: nextPictures };
    });
  };

  return (
    <div className='space-y-6'>
      <Card
        title='Organizations'
        description='Create and manage organizations.'
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
          <div className='md:col-span-2'>
            <Label>Pictures</Label>
            <div className='mt-2 space-y-3'>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <Input
                  id='org-picture-url'
                  type='url'
                  placeholder='https://example.com/photo.jpg'
                  value={newPictureUrl}
                  onChange={(event) =>
                    setNewPictureUrl(event.target.value)
                  }
                />
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handleAddPictureUrl}
                  disabled={isPictureBusy || !newPictureUrl.trim()}
                >
                  Add URL
                </Button>
              </div>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <Input
                  id='org-picture-upload'
                  type='file'
                  accept='image/*'
                  multiple
                  onChange={handlePictureFiles}
                  disabled={isPictureBusy}
                />
                <p className='text-xs text-slate-500 sm:self-center'>
                  Upload files or add URLs. Pictures are saved when
                  you save the organization.
                </p>
              </div>
              {formState.picture_urls.length > 0 ? (
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {formState.picture_urls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className='overflow-hidden rounded-lg border border-slate-200'
                    >
                      <img
                        src={url}
                        alt={`Organization picture ${index + 1}`}
                        className='h-28 w-full object-cover'
                        loading='lazy'
                      />
                      <div
                        className={
                          'flex items-center justify-between gap-2 ' +
                          'px-3 py-2 text-xs'
                        }
                      >
                        <a
                          href={url}
                          target='_blank'
                          rel='noreferrer'
                          className='truncate text-slate-600'
                        >
                          Open
                        </a>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() => removePictureAt(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-xs text-slate-500'>
                  No pictures added yet.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button type='button' onClick={handleSubmit} disabled={isSaving}>
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
                  <th className='py-2'>Description</th>
                  <th className='py-2'>Pictures</th>
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
                      {item.description || '—'}
                    </td>
                    <td className='py-2 text-slate-600'>
                      {item.picture_urls?.length
                        ? `${item.picture_urls.length} total`
                        : '—'}
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
