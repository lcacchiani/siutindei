'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';

import {
  ApiError,
  createOrganizationMediaUpload,
  deleteOrganizationMedia,
  listResource,
  listManagerOrganizations,
  updateResource,
} from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function normalizeMediaUrls(urls: string[]) {
  const cleaned = urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return Array.from(new Set(cleaned));
}

function imageLoader({ src }: ImageLoaderProps) {
  return src;
}

function isManagedMediaUrl(url: string) {
  return url.startsWith('http') && url.includes('amazonaws.com/');
}

async function uploadMediaFile(
  organizationId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  const payload = {
    file_name: file.name,
    content_type: file.type,
  };
  const upload = await createOrganizationMediaUpload(
    organizationId,
    payload
  );

  const response = await fetch(upload.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error('Failed to upload media.');
  }

  return upload.media_url;
}

interface MediaPanelProps {
  mode?: ApiMode;
}

export function MediaPanel({ mode = 'admin' }: MediaPanelProps) {
  const isAdmin = mode === 'admin';
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [pendingMediaDeletes, setPendingMediaDeletes] = useState<
    string[]
  >([]);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>(
    []
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isMediaBusy = isSaving || isProcessingMedia;

  // For managers with a single org, auto-select and disable the dropdown
  const isSingleOrgManager = !isAdmin && organizations.length === 1;

  const selectedOrganization = organizations.find(
    (org) => org.id === selectedOrgId
  );

  useEffect(() => {
    const loadOrganizations = async () => {
      setIsLoadingOrgs(true);
      setError('');
      try {
        let allOrganizations: Organization[];

        if (isAdmin) {
          allOrganizations = [];
          let cursor: string | undefined;

          do {
            const response = await listResource<Organization>(
              'organizations',
              cursor
            );
            allOrganizations.push(...response.items);
            cursor = response.next_cursor ?? undefined;
          } while (cursor);
        } else {
          const response = await listManagerOrganizations();
          allOrganizations = response.items;
        }

        setOrganizations(allOrganizations);

        // Auto-select if manager has exactly one organization
        if (!isAdmin && allOrganizations.length === 1) {
          const singleOrg = allOrganizations[0];
          setSelectedOrgId(singleOrg.id);
          setMediaUrls(singleOrg.media_urls ?? []);
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to load organizations.';
        setError(message);
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    loadOrganizations();
  }, [isAdmin]);

  const handleSelectOrganization = (orgId: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to switch organizations?'
      );
      if (!confirmed) {
        return;
      }
    }

    setSelectedOrgId(orgId);
    setHasUnsavedChanges(false);
    setPendingMediaDeletes([]);
    setUploadedMediaUrls([]);
    setNewMediaUrl('');
    setError('');
    setSuccessMessage('');

    const org = organizations.find((o) => o.id === orgId);
    setMediaUrls(org?.media_urls ?? []);
  };

  const handleAddMediaUrl = () => {
    const trimmed = newMediaUrl.trim();
    if (!trimmed) {
      return;
    }
    setMediaUrls((prev) => normalizeMediaUrls([...prev, trimmed]));
    setPendingMediaDeletes((prev) =>
      prev.filter((url) => url !== trimmed)
    );
    setNewMediaUrl('');
    setHasUnsavedChanges(true);
  };

  const handleMediaFiles = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const target = event.target;
    const files = target.files;
    if (!files || files.length === 0) {
      return;
    }
    if (!selectedOrgId) {
      setError('Please select an organization first.');
      target.value = '';
      return;
    }
    setIsProcessingMedia(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedFiles = Array.from(files);
      const validFiles = selectedFiles.filter((file) =>
        file.type.startsWith('image/')
      );
      if (validFiles.length === 0) {
        setError('Only image files can be uploaded.');
        return;
      }

      const results = await Promise.allSettled(
        validFiles.map((file) => uploadMediaFile(selectedOrgId, file))
      );
      const uploadedUrls = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      if (uploadedUrls.length > 0) {
        setMediaUrls((prev) =>
          normalizeMediaUrls([...prev, ...uploadedUrls])
        );
        setUploadedMediaUrls((prev) =>
          normalizeMediaUrls([...prev, ...uploadedUrls])
        );
        setHasUnsavedChanges(true);
      }

      if (results.some((result) => result.status === 'rejected')) {
        setError('Some uploads failed. Please retry.');
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to upload selected media files.';
      setError(message);
    } finally {
      setIsProcessingMedia(false);
      target.value = '';
    }
  };

  const removeMediaAt = (index: number) => {
    const removedUrl = mediaUrls[index];
    setMediaUrls((prev) => {
      const nextMedia = [...prev];
      nextMedia.splice(index, 1);
      return nextMedia;
    });
    if (removedUrl && selectedOrgId && isManagedMediaUrl(removedUrl)) {
      setPendingMediaDeletes((prev) =>
        normalizeMediaUrls([...prev, removedUrl])
      );
    }
    setHasUnsavedChanges(true);
  };

  const flushMediaDeletes = async (
    organizationId: string,
    currentMediaUrls: string[]
  ) => {
    if (pendingMediaDeletes.length === 0) {
      return;
    }

    const remaining = new Set(currentMediaUrls);
    const deletions = pendingMediaDeletes.filter(
      (url) => !remaining.has(url)
    );
    const managedDeletes = deletions.filter(isManagedMediaUrl);
    if (managedDeletes.length === 0) {
      setPendingMediaDeletes([]);
      return;
    }

    try {
      await Promise.all(
        managedDeletes.map((url) =>
          deleteOrganizationMedia(organizationId, { media_url: url })
        )
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Saved media, but failed to delete some old files.';
      setError(message);
    } finally {
      setPendingMediaDeletes([]);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId || !selectedOrganization) {
      setError('Please select an organization first.');
      return;
    }
    if (isProcessingMedia) {
      setError('Please wait for media processing to finish.');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const normalizedUrls = normalizeMediaUrls(mediaUrls);
      const payload = {
        name: selectedOrganization.name,
        description: selectedOrganization.description ?? null,
        manager_id: selectedOrganization.manager_id,
        media_urls: normalizedUrls,
      };

      const updated = await updateResource<typeof payload, Organization>(
        'organizations',
        selectedOrgId,
        payload
      );

      // Update the organizations list with updated media_urls
      setOrganizations((prev) =>
        prev.map((org) => (org.id === selectedOrgId ? updated : org))
      );

      await flushMediaDeletes(selectedOrgId, normalizedUrls);

      setUploadedMediaUrls([]);
      setHasUnsavedChanges(false);
      setSuccessMessage('Media saved successfully.');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save media.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = async () => {
    if (!selectedOrgId) {
      return;
    }

    // Clean up uploaded media that haven't been saved
    if (uploadedMediaUrls.length > 0) {
      setIsProcessingMedia(true);
      try {
        await Promise.all(
          uploadedMediaUrls.map((url) =>
            deleteOrganizationMedia(selectedOrgId, { media_url: url })
          )
        );
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Unable to clean up uploaded media.';
        setError(message);
      } finally {
        setIsProcessingMedia(false);
      }
    }

    // Reset to original state
    const org = organizations.find((o) => o.id === selectedOrgId);
    setMediaUrls(org?.media_urls ?? []);
    setPendingMediaDeletes([]);
    setUploadedMediaUrls([]);
    setHasUnsavedChanges(false);
    setSuccessMessage('');
  };

  return (
    <div className='space-y-6'>
      <Card
        title='Organization Media'
        description='Select an organization to manage its media.'
      >
        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}
        {successMessage && (
          <div className='mb-4'>
            <StatusBanner variant='success' title='Success'>
              {successMessage}
            </StatusBanner>
          </div>
        )}
        <div className='space-y-4'>
          <div>
            <Label htmlFor='org-select'>Organization</Label>
            <Select
              id='org-select'
              value={selectedOrgId}
              onChange={(event) =>
                handleSelectOrganization(event.target.value)
              }
              disabled={isLoadingOrgs || isMediaBusy || isSingleOrgManager}
            >
              <option value=''>
                {isLoadingOrgs
                  ? 'Loading organizations...'
                  : 'Select an organization'}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {selectedOrgId && (
        <Card
          title={`Media for ${selectedOrganization?.name ?? 'Organization'}`}
          description='Add or remove media for this organization.'
        >
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Input
                id='media-url'
                type='url'
                placeholder='https://example.com/photo.jpg'
                value={newMediaUrl}
                onChange={(event) => setNewMediaUrl(event.target.value)}
                disabled={isMediaBusy}
              />
              <Button
                type='button'
                variant='secondary'
                onClick={handleAddMediaUrl}
                disabled={isMediaBusy || !newMediaUrl.trim()}
                title='Add URL'
              >
                <PlusIcon className='h-4 w-4' />
              </Button>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Input
                id='media-upload'
                type='file'
                accept='image/*'
                multiple
                onChange={handleMediaFiles}
                disabled={isMediaBusy}
              />
              <p className='text-xs text-slate-500 sm:self-center'>
                Upload files or add URLs. Save to apply changes.
              </p>
            </div>

            {mediaUrls.length > 0 ? (
              <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
                {mediaUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className='overflow-hidden rounded-lg border border-slate-200'
                  >
                    <Image
                      src={url}
                      alt={`Organization media ${index + 1}`}
                      width={320}
                      height={112}
                      sizes={
                        '(min-width: 1024px) 33vw, ' +
                        '(min-width: 640px) 50vw, 100vw'
                      }
                      className='h-32 w-full object-cover sm:h-28'
                      loading='lazy'
                      loader={imageLoader}
                    />
                    <div className='flex items-center justify-between gap-2 px-3 py-2 text-xs'>
                      <a
                        href={url}
                        target='_blank'
                        rel='noreferrer'
                        className='truncate text-slate-600 hover:text-slate-900'
                      >
                        Open
                      </a>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={() => removeMediaAt(index)}
                        disabled={isMediaBusy}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-slate-500'>
                No media added yet. Upload files or add URLs above.
              </p>
            )}

            <div className='flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:gap-3'>
              <Button
                type='button'
                onClick={handleSave}
                disabled={isMediaBusy || !hasUnsavedChanges}
                className='w-full sm:w-auto'
              >
                {isSaving ? 'Saving...' : 'Save media'}
              </Button>
              {hasUnsavedChanges && (
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => void handleCancelChanges()}
                  disabled={isMediaBusy}
                  className='w-full sm:w-auto'
                >
                  Cancel changes
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {!selectedOrgId && !isLoadingOrgs && organizations.length > 0 && (
        <Card
          title='Select an organization'
          description='Choose an organization from the dropdown above to manage its media.'
        >
          <p className='text-sm text-slate-600'>
            You can upload images or add media URLs to any organization.
            Media is saved when you click the &ldquo;Save media&rdquo;
            button.
          </p>
        </Card>
      )}

      {!selectedOrgId && !isLoadingOrgs && organizations.length === 0 && (
        <Card
          title='No organizations found'
          description='Create an organization first to manage its media.'
        >
          <p className='text-sm text-slate-600'>
            Go to the Organizations section to create a new organization, then
            return here to add media.
          </p>
        </Card>
      )}
    </div>
  );
}
