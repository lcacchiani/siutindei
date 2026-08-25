'use client';

import { useEffect, useMemo, useState } from 'react';

import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
import { ApiError, listResource } from '../../lib/api-client';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../../lib/api-client-api-keys';
import { formatDateTime } from '../../lib/date-utils';
import type { ApiKey, Organization } from '../../types/admin';
import { DeleteIcon } from '../icons/action-icons';
import { StatusBanner } from '../status-banner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBadge } from '../ui/status-badge';

interface ApiKeyFormState {
  name: string;
  scope: 'read' | 'crud';
  org_id: string;
  expires_at: string;
}

const emptyForm: ApiKeyFormState = {
  name: '',
  scope: 'read',
  org_id: '',
  expires_at: '',
};

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState<ApiKeyFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadKeys = async (cursor?: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await listApiKeys(cursor, 50);
      setKeys((prev) =>
        cursor ? [...prev, ...response.items] : response.items
      );
      setNextCursor(response.next_cursor ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load API keys.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadKeys();
    listResource<Organization>('organizations', undefined, 200)
      .then((response) => setOrganizations(response.items))
      .catch(() => {
        // Organization names fall back to raw ids when the lookup fails.
      });
  }, []);

  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizations) {
      map.set(org.id, org.name);
    }
    return map;
  }, [organizations]);

  const handleCreate = async () => {
    if (!formState.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    let expiresAt: string | null = null;
    if (formState.expires_at) {
      const parsed = new Date(formState.expires_at);
      if (Number.isNaN(parsed.getTime())) {
        setFormError('Expiry date is invalid.');
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        setFormError('Expiry date must be in the future.');
        return;
      }
      expiresAt = parsed.toISOString();
    }

    setIsSaving(true);
    setFormError('');
    setCreatedKey(null);
    setCopied(false);
    try {
      const created = await createApiKey({
        name: formState.name.trim(),
        scope: formState.scope,
        org_id: formState.org_id || null,
        expires_at: expiresAt,
      });
      setCreatedKey(created.api_key);
      setFormState(emptyForm);
      setKeys((prev) => [created, ...prev]);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to create API key.';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const requestRevoke = async (apiKey: ApiKey) => {
    const confirmed = await confirm(
      'Revoke API key?',
      `Revoke "${apiKey.name}"? Requests using this key will be ` +
        'rejected within a few minutes. This action cannot be undone.',
      { variant: 'danger', confirmLabel: 'Revoke Key' }
    );
    if (!confirmed) {
      return;
    }
    setRevokingId(apiKey.id);
    setError('');
    try {
      const revoked = await revokeApiKey(apiKey.id);
      setKeys((prev) =>
        prev.map((key) => (key.id === revoked.id ? revoked : key))
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to revoke API key.';
      setError(message);
    } finally {
      setRevokingId(null);
    }
  };

  const filteredKeys = keys.filter((apiKey) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orgName = apiKey.org_id
      ? (orgNameById.get(apiKey.org_id) ?? apiKey.org_id)
      : 'full access';
    return (
      apiKey.name.toLowerCase().includes(query) ||
      apiKey.key_prefix.toLowerCase().includes(query) ||
      apiKey.scope.toLowerCase().includes(query) ||
      apiKey.status.toLowerCase().includes(query) ||
      orgName.toLowerCase().includes(query)
    );
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        primary: true,
        render: (apiKey: ApiKey) => (
          <div className='min-w-0'>
            <div className='truncate font-medium'>{apiKey.name}</div>
            <div className='font-mono text-xs text-slate-500'>
              {apiKey.key_prefix}...
            </div>
          </div>
        ),
      },
      {
        key: 'scope',
        header: 'Scope',
        render: (apiKey: ApiKey) => (
          <span className='uppercase text-xs font-medium text-slate-600'>
            {apiKey.scope}
          </span>
        ),
      },
      {
        key: 'organization',
        header: 'Organization',
        render: (apiKey: ApiKey) => (
          <span className='text-slate-600'>
            {apiKey.org_id
              ? (orgNameById.get(apiKey.org_id) ?? apiKey.org_id)
              : 'Full access'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (apiKey: ApiKey) => <StatusBadge status={apiKey.status} />,
      },
      {
        key: 'expires',
        header: 'Expires',
        render: (apiKey: ApiKey) => (
          <span className='text-slate-600'>
            {apiKey.expires_at ? formatDateTime(apiKey.expires_at) : 'Never'}
          </span>
        ),
      },
      {
        key: 'last-used',
        header: 'Last Used',
        render: (apiKey: ApiKey) => (
          <span className='text-slate-600'>
            {formatDateTime(apiKey.last_used_at)}
          </span>
        ),
      },
    ],
    [orgNameById]
  );

  function renderActions(apiKey: ApiKey, context: 'desktop' | 'mobile') {
    if (apiKey.status === 'revoked') {
      return (
        <span className='text-xs text-slate-400'>
          Revoked {formatDateTime(apiKey.revoked_at)}
        </span>
      );
    }
    const button = (
      <Button
        type='button'
        size='sm'
        variant='danger'
        onClick={() => {
          void requestRevoke(apiKey);
        }}
        disabled={revokingId === apiKey.id}
        title='Revoke Key'
      >
        {revokingId === apiKey.id ? '...' : <DeleteIcon className='h-4 w-4' />}
      </Button>
    );
    if (context === 'mobile') {
      return <div className='flex flex-1 justify-center gap-2'>{button}</div>;
    }
    return button;
  }

  return (
    <div className='space-y-6'>
      <Card
        title='New API Key'
        description='Issue a partner API key for the public partner endpoints. Read keys can query data; CRUD keys can also edit it. Scope a key to one organization or leave it with full access.'
      >
        {formError && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {formError}
            </StatusBanner>
          </div>
        )}

        {createdKey && (
          <div className='mb-4'>
            {/* StatusBanner renders children inside a <p>, so only
                inline elements are allowed here. */}
            <StatusBanner variant='success' title='API key created'>
              <span className='mb-2 block'>
                Copy the key now. It is shown only once and cannot be
                retrieved later.
              </span>
              <span className='flex flex-wrap items-center gap-2'>
                <code
                  className='rounded bg-white px-2 py-1 font-mono text-xs'
                  data-testid='created-api-key'
                >
                  {createdKey}
                </code>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    void handleCopy();
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  onClick={() => setCreatedKey(null)}
                >
                  Dismiss
                </Button>
              </span>
            </StatusBanner>
          </div>
        )}

        <div className='space-y-4'>
          <div>
            <Label htmlFor='api-key-name'>Name</Label>
            <Input
              id='api-key-name'
              placeholder='e.g. Partner Co integration'
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <Label htmlFor='api-key-scope'>Scope</Label>
              <Select
                id='api-key-scope'
                value={formState.scope}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    scope: e.target.value as 'read' | 'crud',
                  }))
                }
              >
                <option value='read'>Read (query only)</option>
                <option value='crud'>CRUD (query and edit)</option>
              </Select>
            </div>

            <div>
              <Label htmlFor='api-key-org'>Organization</Label>
              <Select
                id='api-key-org'
                value={formState.org_id}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    org_id: e.target.value,
                  }))
                }
              >
                <option value=''>Full access (all organizations)</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor='api-key-expires'>Expiry (optional)</Label>
            <Input
              id='api-key-expires'
              type='datetime-local'
              value={formState.expires_at}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  expires_at: e.target.value,
                }))
              }
            />
            <p className='mt-1 text-xs text-slate-500'>
              Leave empty for a key that never expires.
            </p>
          </div>

          <div className='pt-2'>
            <Button
              type='button'
              variant='primary'
              onClick={() => {
                void handleCreate();
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title='API Keys'
        description='Manage issued partner API keys. Revoking a key takes effect within a few minutes.'
      >
        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}

        <div className='mb-4 max-w-sm'>
          <SearchInput
            placeholder='Search keys...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredKeys}
          keyExtractor={(item) => item.id}
          renderActions={renderActions}
          nextCursor={nextCursor}
          onLoadMore={() => loadKeys(nextCursor ?? undefined)}
          isLoading={isLoading}
          emptyMessage={
            searchQuery.trim()
              ? 'No API keys match your search.'
              : 'No API keys found.'
          }
        />
      </Card>
      {confirmDialog}
    </div>
  );
}
