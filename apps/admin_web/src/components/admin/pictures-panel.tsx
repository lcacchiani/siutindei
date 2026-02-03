'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';

import {
  ApiError,
  createOrganizationPictureUpload,
  deleteOrganizationPicture,
  listResource,
  updateResource,
} from '../../lib/api-client';
import type { Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

function normalizePictureUrls(urls: string[]) {
  const cleaned = urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return Array.from(new Set(cleaned));
}

function imageLoader({ src }: ImageLoaderProps) {
  return src;
}

function isManagedPictureUrl(url: string) {
  return url.startsWith('http') && url.includes('amazonaws.com/');
}

async function uploadPictureFile(
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
  const upload = await createOrganizationPictureUpload(
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
    throw new Error('Failed to upload picture.');
  }

  return upload.picture_url;
}

export function PicturesPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPictures, setIsProcessingPictures] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pictureUrls, setPictureUrls] = useState<string[]>([]);
  const [newPictureUrl, setNewPictureUrl] = useState('');
  const [pendingPictureDeletes, setPendingPictureDeletes] = useState<
    string[]
  >([]);
  const [uploadedPictureUrls, setUploadedPictureUrls] = useState<string[]>(
    []
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isPictureBusy = isSaving || isProcessingPictures;

  const selectedOrganization = organizations.find(
    (org) => org.id === selectedOrgId
  );

  const loadOrganizations = async () => {
    setIsLoadingOrgs(true);
    setError('');
    try {
      const allOrganizations: Organization[] = [];
      let cursor: string | undefined;

      do {
        const response = await listResource<Organization>(
          'organizations',
          cursor
        );
        allOrganizations.push(...response.items);
        cursor = response.next_cursor ?? undefined;
      } while (cursor);

      setOrganizations(allOrganizations);
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

  useEffect(() => {
    loadOrganizations();
  }, []);

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
    setPendingPictureDeletes([]);
    setUploadedPictureUrls([]);
    setNewPictureUrl('');
    setError('');
    setSuccessMessage('');

    const org = organizations.find((o) => o.id === orgId);
    setPictureUrls(org?.picture_urls ?? []);
  };

  const handleAddPictureUrl = () => {
    const trimmed = newPictureUrl.trim();
    if (!trimmed) {
      return;
    }
    setPictureUrls((prev) => normalizePictureUrls([...prev, trimmed]));
    setPendingPictureDeletes((prev) =>
      prev.filter((url) => url !== trimmed)
    );
    setNewPictureUrl('');
    setHasUnsavedChanges(true);
  };

  const handlePictureFiles = async (
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
    setIsProcessingPictures(true);
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
        validFiles.map((file) => uploadPictureFile(selectedOrgId, file))
      );
      const uploadedUrls = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      if (uploadedUrls.length > 0) {
        setPictureUrls((prev) =>
          normalizePictureUrls([...prev, ...uploadedUrls])
        );
        setUploadedPictureUrls((prev) =>
          normalizePictureUrls([...prev, ...uploadedUrls])
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
          : 'Unable to upload selected picture files.';
      setError(message);
    } finally {
      setIsProcessingPictures(false);
      target.value = '';
    }
  };

  const removePictureAt = (index: number) => {
    const removedUrl = pictureUrls[index];
    setPictureUrls((prev) => {
      const nextPictures = [...prev];
      nextPictures.splice(index, 1);
      return nextPictures;
    });
    if (removedUrl && selectedOrgId && isManagedPictureUrl(removedUrl)) {
      setPendingPictureDeletes((prev) =>
        normalizePictureUrls([...prev, removedUrl])
      );
    }
    setHasUnsavedChanges(true);
  };

  const flushPictureDeletes = async (
    organizationId: string,
    currentPictureUrls: string[]
  ) => {
    if (pendingPictureDeletes.length === 0) {
      return;
    }

    const remaining = new Set(currentPictureUrls);
    const deletions = pendingPictureDeletes.filter(
      (url) => !remaining.has(url)
    );
    const managedDeletes = deletions.filter(isManagedPictureUrl);
    if (managedDeletes.length === 0) {
      setPendingPictureDeletes([]);
      return;
    }

    try {
      await Promise.all(
        managedDeletes.map((url) =>
          deleteOrganizationPicture(organizationId, { picture_url: url })
        )
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Saved pictures, but failed to delete some old pictures.';
      setError(message);
    } finally {
      setPendingPictureDeletes([]);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId || !selectedOrganization) {
      setError('Please select an organization first.');
      return;
    }
    if (isProcessingPictures) {
      setError('Please wait for picture processing to finish.');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const normalizedUrls = normalizePictureUrls(pictureUrls);
      const payload = {
        name: selectedOrganization.name,
        description: selectedOrganization.description ?? null,
        owner_id: selectedOrganization.owner_id,
        picture_urls: normalizedUrls,
      };

      const updated = await updateResource<typeof payload, Organization>(
        'organizations',
        selectedOrgId,
        payload
      );

      // Update the organizations list with updated picture_urls
      setOrganizations((prev) =>
        prev.map((org) => (org.id === selectedOrgId ? updated : org))
      );

      await flushPictureDeletes(selectedOrgId, normalizedUrls);

      setUploadedPictureUrls([]);
      setHasUnsavedChanges(false);
      setSuccessMessage('Pictures saved successfully.');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to save pictures.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = async () => {
    if (!selectedOrgId) {
      return;
    }

    // Clean up uploaded pictures that haven't been saved
    if (uploadedPictureUrls.length > 0) {
      setIsProcessingPictures(true);
      try {
        await Promise.all(
          uploadedPictureUrls.map((url) =>
            deleteOrganizationPicture(selectedOrgId, { picture_url: url })
          )
        );
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Unable to clean up uploaded pictures.';
        setError(message);
      } finally {
        setIsProcessingPictures(false);
      }
    }

    // Reset to original state
    const org = organizations.find((o) => o.id === selectedOrgId);
    setPictureUrls(org?.picture_urls ?? []);
    setPendingPictureDeletes([]);
    setUploadedPictureUrls([]);
    setHasUnsavedChanges(false);
    setSuccessMessage('');
  };

  return (
    <div className='space-y-6'>
      <Card
        title='Organization Pictures'
        description='Select an organization to manage its pictures.'
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
              disabled={isLoadingOrgs || isPictureBusy}
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
          title={`Pictures for ${selectedOrganization?.name ?? 'Organization'}`}
          description='Add or remove pictures for this organization.'
        >
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Input
                id='picture-url'
                type='url'
                placeholder='https://example.com/photo.jpg'
                value={newPictureUrl}
                onChange={(event) => setNewPictureUrl(event.target.value)}
                disabled={isPictureBusy}
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
                id='picture-upload'
                type='file'
                accept='image/*'
                multiple
                onChange={handlePictureFiles}
                disabled={isPictureBusy}
              />
              <p className='text-xs text-slate-500 sm:self-center'>
                Upload files or add URLs. Save to apply changes.
              </p>
            </div>

            {pictureUrls.length > 0 ? (
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {pictureUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className='overflow-hidden rounded-lg border border-slate-200'
                  >
                    <Image
                      src={url}
                      alt={`Organization picture ${index + 1}`}
                      width={320}
                      height={112}
                      sizes={
                        '(min-width: 1024px) 33vw, ' +
                        '(min-width: 640px) 50vw, 100vw'
                      }
                      className='h-28 w-full object-cover'
                      loading='lazy'
                      loader={imageLoader}
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
                        disabled={isPictureBusy}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-slate-500'>
                No pictures added yet. Upload files or add URLs above.
              </p>
            )}

            <div className='flex flex-wrap gap-3 pt-2'>
              <Button
                type='button'
                onClick={handleSave}
                disabled={isPictureBusy || !hasUnsavedChanges}
              >
                {isSaving ? 'Saving...' : 'Save pictures'}
              </Button>
              {hasUnsavedChanges && (
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => void handleCancelChanges()}
                  disabled={isPictureBusy}
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
          description='Choose an organization from the dropdown above to manage its pictures.'
        >
          <p className='text-sm text-slate-600'>
            You can upload images or add picture URLs to any organization.
            Pictures are saved when you click the &ldquo;Save pictures&rdquo;
            button.
          </p>
        </Card>
      )}

      {!selectedOrgId && !isLoadingOrgs && organizations.length === 0 && (
        <Card
          title='No organizations found'
          description='Create an organization first to manage its pictures.'
        >
          <p className='text-sm text-slate-600'>
            Go to the Organizations section to create a new organization, then
            return here to add pictures.
          </p>
        </Card>
      )}
    </div>
  );
}
