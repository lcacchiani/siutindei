'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';

import {
  ApiError,
  createOrganizationMediaUpload,
  deleteOrganizationMedia,
  updateResource,
} from '../../lib/api-client';
import { useOrganizationsByMode } from '../../hooks/use-organizations-by-mode';
import type { ApiMode } from '../../lib/resource-api';
import type { Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { FileUploadButton } from '../ui/file-upload-button';
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

function reorderMediaUrls(
  urls: string[],
  fromIndex: number,
  toIndex: number
) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= urls.length ||
    toIndex >= urls.length ||
    fromIndex === toIndex
  ) {
    return urls;
  }
  const next = [...urls];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function resolveLogoMediaUrl(
  mediaUrls: string[],
  logoMediaUrl?: string | null
) {
  if (!logoMediaUrl) {
    return null;
  }
  return mediaUrls.includes(logoMediaUrl) ? logoMediaUrl : null;
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
  const {
    items: orgItems,
    isLoading: isLoadingOrgs,
    error: organizationsError,
  } = useOrganizationsByMode(mode, { fetchAll: true, limit: 50 });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [orgTouched, setOrgTouched] = useState(false);
  const [orgActionAttempted, setOrgActionAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [logoMediaUrl, setLogoMediaUrl] = useState<string | null>(null);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [pendingMediaDeletes, setPendingMediaDeletes] = useState<
    string[]
  >([]);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>(
    []
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';

  const showOrgError =
    !selectedOrgId && (orgTouched || orgActionAttempted);
  const orgErrorMessage = showOrgError ? 'Select an organization.' : '';

  const isMediaBusy = isSaving || isProcessingMedia;

  // For managers with a single org, auto-select and disable the dropdown
  const isSingleOrgManager = !isAdmin && organizations.length === 1;

  const selectedOrganization = organizations.find(
    (org) => org.id === selectedOrgId
  );

  useEffect(() => {
    setOrganizations(orgItems);
    if (isAdmin || selectedOrgId) {
      return;
    }
    if (orgItems.length === 1) {
      const singleOrg = orgItems[0];
      const nextMediaUrls = singleOrg.media_urls ?? [];
      setSelectedOrgId(singleOrg.id);
      setOrgTouched(false);
      setOrgActionAttempted(false);
      setMediaUrls(nextMediaUrls);
      setLogoMediaUrl(
        resolveLogoMediaUrl(nextMediaUrls, singleOrg.logo_media_url)
      );
    }
  }, [isAdmin, orgItems, selectedOrgId]);

  useEffect(() => {
    if (organizationsError) {
      setError(organizationsError);
    }
  }, [organizationsError]);

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
    setOrgTouched(true);
    setOrgActionAttempted(false);
    setHasUnsavedChanges(false);
    setPendingMediaDeletes([]);
    setUploadedMediaUrls([]);
    setNewMediaUrl('');
    setError('');
    setSuccessMessage('');
    setDragIndex(null);
    setDragOverIndex(null);

    const org = organizations.find((o) => o.id === orgId);
    const nextMediaUrls = org?.media_urls ?? [];
    setMediaUrls(nextMediaUrls);
    setLogoMediaUrl(
      resolveLogoMediaUrl(nextMediaUrls, org?.logo_media_url)
    );
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
      setOrgActionAttempted(true);
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
    if (removedUrl && removedUrl === logoMediaUrl) {
      setLogoMediaUrl(null);
    }
    if (removedUrl && selectedOrgId && isManagedMediaUrl(removedUrl)) {
      setPendingMediaDeletes((prev) =>
        normalizeMediaUrls([...prev, removedUrl])
      );
    }
    setHasUnsavedChanges(true);
  };

  const handleSelectLogo = (url: string) => {
    setLogoMediaUrl(url);
    setHasUnsavedChanges(true);
  };

  const moveMediaTo = (fromIndex: number, toIndex: number) => {
    setMediaUrls((prev) => reorderMediaUrls(prev, fromIndex, toIndex));
    setHasUnsavedChanges(true);
  };

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (isMediaBusy) {
      return;
    }
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    index: number
  ) => {
    if (isMediaBusy) {
      return;
    }
    event.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    index: number
  ) => {
    if (isMediaBusy) {
      return;
    }
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const fromIndex = dragIndex !== null ? dragIndex : Number(raw);
    if (Number.isNaN(fromIndex) || fromIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setMediaUrls((prev) => reorderMediaUrls(prev, fromIndex, index));
    setHasUnsavedChanges(true);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
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
      setOrgActionAttempted(true);
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
      const normalizedLogo =
        logoMediaUrl && normalizedUrls.includes(logoMediaUrl)
          ? logoMediaUrl
          : null;
      const payload = {
        name: selectedOrganization.name,
        description: selectedOrganization.description ?? null,
        manager_id: selectedOrganization.manager_id,
        media_urls: normalizedUrls,
        logo_media_url: normalizedLogo,
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
      setLogoMediaUrl(updated.logo_media_url ?? null);

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
    const nextMediaUrls = org?.media_urls ?? [];
    setMediaUrls(nextMediaUrls);
    setLogoMediaUrl(
      resolveLogoMediaUrl(nextMediaUrls, org?.logo_media_url)
    );
    setPendingMediaDeletes([]);
    setUploadedMediaUrls([]);
    setHasUnsavedChanges(false);
    setSuccessMessage('');
    setDragIndex(null);
    setDragOverIndex(null);
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
          <div className='space-y-1'>
            <Label htmlFor='org-select'>
              Organization{' '}
              <span className='ml-1'>{requiredIndicator}</span>
            </Label>
            <Select
              id='org-select'
              value={selectedOrgId}
              onChange={(event) =>
                handleSelectOrganization(event.target.value)
              }
              disabled={isLoadingOrgs || isMediaBusy || isSingleOrgManager}
              className={showOrgError ? errorInputClassName : ''}
              aria-invalid={showOrgError || undefined}
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
            {showOrgError ? (
              <p className='text-xs text-red-600'>{orgErrorMessage}</p>
            ) : null}
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
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <FileUploadButton
                id='media-upload'
                accept='image/*'
                multiple
                onChange={handleMediaFiles}
                disabled={isMediaBusy}
                buttonLabel='Choose files'
                inputAriaLabel='Upload media files'
              />
              <p className='text-xs text-slate-500 sm:self-center'>
                Upload files or add URLs. Drag or use arrows to reorder.
                Select a logo, then save to apply changes.
              </p>
            </div>

            {mediaUrls.length > 0 ? (
              <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
                {mediaUrls.map((url, index) => {
                  const isDropTarget =
                    dragOverIndex === index && dragIndex !== null;
                  const isFirst = index === 0;
                  const isLast = index === mediaUrls.length - 1;
                  return (
                    <div
                      key={`${url}-${index}`}
                      className={`overflow-hidden rounded-lg border border-slate-200 ${
                        isDropTarget ? 'ring-2 ring-sky-400' : ''
                      }`}
                      onDragOver={(event) => handleDragOver(event, index)}
                      onDrop={(event) => handleDrop(event, index)}
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
                        <div className='flex items-center gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            className='px-2 text-xs'
                            draggable={!isMediaBusy}
                            onDragStart={(event) =>
                              handleDragStart(event, index)
                            }
                            onDragEnd={handleDragEnd}
                            disabled={isMediaBusy}
                          >
                            Drag
                          </Button>
                          <label className='flex items-center gap-2 text-slate-600'>
                            <input
                              type='radio'
                              name='logo_media'
                              value={url}
                              checked={logoMediaUrl === url}
                              onChange={() => handleSelectLogo(url)}
                              disabled={isMediaBusy}
                              className='h-3 w-3'
                            />
                            <span>Logo</span>
                          </label>
                        </div>
                        <div className='flex items-center gap-1'>
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            onClick={() => moveMediaTo(index, index - 1)}
                            disabled={isMediaBusy || isFirst}
                          >
                            Up
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            onClick={() => moveMediaTo(index, index + 1)}
                            disabled={isMediaBusy || isLast}
                          >
                            Down
                          </Button>
                        </div>
                      </div>
                      <div className='flex items-center justify-between gap-2 px-3 pb-3 text-xs'>
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
                  );
                })}
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
