'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  listCognitoUsers,
  addUserToGroup,
  removeUserFromGroup,
  deleteCognitoUser,
  type CognitoUsersResponse,
} from '../../lib/api-client';
import type { CognitoUser } from '../../types/admin';
import { useAuth } from '../auth-provider';
import {
  AppleIcon,
  DeleteIcon,
  EmailIcon,
  GoogleIcon,
  MicrosoftIcon,
  ViewIcon,
} from '../icons/action-icons';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { SearchInput } from '../ui/search-input';
import { StatusBanner } from '../status-banner';

function RoleBadge({
  role,
  isActive,
}: {
  role: 'admin' | 'manager';
  isActive: boolean;
}) {
  const colors = isActive
    ? role === 'admin'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

type IdentityProvider = 'Google' | 'Apple' | 'Microsoft' | 'Email';

function getIdentityProvider(username: string | null | undefined): IdentityProvider {
  if (!username) return 'Email';
  const lowerUsername = username.toLowerCase();
  if (lowerUsername.startsWith('google_')) return 'Google';
  if (lowerUsername.startsWith('signinwithapple_')) return 'Apple';
  if (lowerUsername.startsWith('azuread_') || lowerUsername.startsWith('microsoft_')) return 'Microsoft';
  return 'Email';
}

function ShieldIcon({ className }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IdentityProviderBadge({ username }: { username: string | null | undefined }) {
  const provider = getIdentityProvider(username);

  const icons: Record<IdentityProvider, React.ReactNode> = {
    Google: <GoogleIcon className='h-4 w-4' />,
    Apple: <AppleIcon className='h-4 w-4' />,
    Microsoft: <MicrosoftIcon className='h-4 w-4' />,
    Email: <EmailIcon className='h-4 w-4 text-slate-500' />,
  };

  return (
    <span title={provider} className='inline-flex items-center'>
      {icons[provider]}
    </span>
  );
}

export function CognitoUsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [paginationToken, setPaginationToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<CognitoUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async (token?: string, reset = false) => {
    setIsLoading(true);
    setError('');
    try {
      const response: CognitoUsersResponse = await listCognitoUsers(token, 50);
      setUsers((prev) =>
        reset || !token ? response.items : [...prev, ...response.items]
      );
      setPaginationToken(response.pagination_token ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load users.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(undefined, true);
  }, []);

  const handleToggleRole = async (
    targetUser: CognitoUser,
    role: 'admin' | 'manager',
    currentlyHasRole: boolean
  ) => {
    if (!targetUser.username) {
      setActionError('User has no username');
      return;
    }

    const actionKey = `${targetUser.sub}-${role}`;
    setActionLoading(actionKey);
    setActionError('');

    try {
      if (currentlyHasRole) {
        await removeUserFromGroup(targetUser.username, role);
      } else {
        await addUserToGroup(targetUser.username, role);
      }

      // Update the local state
      setUsers((prev) =>
        prev.map((u) => {
          if (u.sub === targetUser.sub) {
            const newGroups = currentlyHasRole
              ? (u.groups || []).filter((g) => g !== role)
              : [...(u.groups || []), role];
            return { ...u, groups: newGroups };
          }
          return u;
        })
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Failed to ${currentlyHasRole ? 'remove' : 'add'} ${role} role.`;
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (targetUser: CognitoUser) => {
    if (!targetUser.username) {
      setActionError('User has no username');
      return;
    }

    const actionKey = `delete-${targetUser.sub}`;
    setActionLoading(actionKey);
    setActionError('');
    setDeleteConfirm(null);

    try {
      const response = await deleteCognitoUser(targetUser.username);

      // Remove the user from the local state
      setUsers((prev) => prev.filter((u) => u.sub !== targetUser.sub));

      // Show success message if organizations were transferred
      if (response.transferred_organizations_count > 0) {
        setActionError(''); // Clear any previous error
        // Use actionError temporarily to show success (could be improved with separate state)
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to delete user.';
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentUser = (cognitoUser: CognitoUser) => {
    // Compare by subject (Cognito subject identifier)
    return currentUser?.subject === cognitoUser.sub;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Format a datetime string for display with both date and time.
   * Uses the browser's timezone for display, falling back to UTC if unavailable.
   */
  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';

      // Get the browser's timezone
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
        timeZoneName: 'short',
      });
    } catch {
      return '-';
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter((cognitoUser) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const groupsStr = cognitoUser.groups?.join(', ')?.toLowerCase() || '';
    return (
      cognitoUser.email?.toLowerCase().includes(query) ||
      cognitoUser.username?.toLowerCase().includes(query) ||
      cognitoUser.name?.toLowerCase().includes(query) ||
      cognitoUser.status?.toLowerCase().includes(query) ||
      groupsStr.includes(query)
    );
  });

  const columns = [
    {
      key: 'email',
      header: 'Email',
      primary: true,
      render: (cognitoUser: CognitoUser) => {
        const isCurrent = isCurrentUser(cognitoUser);
        return (
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <span className='truncate font-medium'>
                {cognitoUser.email || cognitoUser.username || 'Unknown'}
              </span>
              <IdentityProviderBadge username={cognitoUser.username} />
              {isCurrent && (
                <span className='rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600'>
                  You
                </span>
              )}
            </div>
            {cognitoUser.name && (
              <div className='text-xs text-slate-500'>
                {cognitoUser.name}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (cognitoUser: CognitoUser) => {
        const hasAdminRole = cognitoUser.groups?.includes('admin') || false;
        const hasManagerRole = cognitoUser.groups?.includes('manager') || false;
        return (
          <div className='flex gap-1'>
            <RoleBadge role='admin' isActive={hasAdminRole} />
            <RoleBadge role='manager' isActive={hasManagerRole} />
          </div>
        );
      },
    },
    {
      key: 'last-login',
      header: 'Last Login',
      render: (cognitoUser: CognitoUser) => (
        <span className='text-slate-600'>
          {formatDateTime(cognitoUser.last_auth_time)}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (cognitoUser: CognitoUser) => (
        <span className='text-slate-600'>
          {formatDate(cognitoUser.created_at)}
        </span>
      ),
    },
  ];

  function renderActions(
    cognitoUser: CognitoUser,
    context: 'desktop' | 'mobile'
  ) {
    const hasAdminRole = cognitoUser.groups?.includes('admin') || false;
    const hasManagerRole = cognitoUser.groups?.includes('manager') || false;
    const isCurrent = isCurrentUser(cognitoUser);

    const viewButton = (
      <Button
        type='button'
        size='sm'
        variant='ghost'
        onClick={() => setSelectedUser(cognitoUser)}
        title='View attributes'
      >
        <ViewIcon className='h-4 w-4' />
      </Button>
    );

    const buttons = (
      <>
        {viewButton}
        <Button
          type='button'
          size='sm'
          variant={hasAdminRole ? 'danger' : 'secondary'}
          onClick={() => handleToggleRole(cognitoUser, 'admin', hasAdminRole)}
          disabled={actionLoading === `${cognitoUser.sub}-admin`}
          title={hasAdminRole ? 'Remove Admin' : 'Make Admin'}
        >
          {actionLoading === `${cognitoUser.sub}-admin` ? (
            '...'
          ) : (
            <ShieldIcon className='h-4 w-4' />
          )}
        </Button>
        <Button
          type='button'
          size='sm'
          variant={hasManagerRole ? 'danger' : 'secondary'}
          onClick={() =>
            handleToggleRole(cognitoUser, 'manager', hasManagerRole)
          }
          disabled={actionLoading === `${cognitoUser.sub}-manager`}
          title={hasManagerRole ? 'Remove Manager' : 'Make Manager'}
        >
          {actionLoading === `${cognitoUser.sub}-manager` ? (
            '...'
          ) : (
            <BriefcaseIcon className='h-4 w-4' />
          )}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='danger'
          onClick={() => setDeleteConfirm(cognitoUser)}
          disabled={actionLoading === `delete-${cognitoUser.sub}`}
          title='Delete User'
        >
          {actionLoading === `delete-${cognitoUser.sub}` ? (
            '...'
          ) : (
            <DeleteIcon className='h-4 w-4' />
          )}
        </Button>
      </>
    );

    if (isCurrent) {
      return (
        <div
          className={
            context === 'mobile'
              ? 'flex flex-1 items-center justify-center gap-2'
              : 'flex items-center justify-end gap-2'
          }
        >
          {viewButton}
          <span className='text-xs text-slate-400'>
            Cannot modify your own account
          </span>
        </div>
      );
    }

    if (context === 'mobile') {
      return <div className='flex flex-1 justify-center gap-2'>{buttons}</div>;
    }

    return buttons;
  }

  return (
    <div className='space-y-6'>
      <Card
        title='Users'
        description='Manage user roles across all identity providers. Promote or demote users to Admin or Manager roles.'
      >
        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}

        {actionError && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Action Failed'>
              {actionError}
            </StatusBanner>
          </div>
        )}

        {isLoading && users.length === 0 ? (
          <p className='text-sm text-slate-600'>Loading users...</p>
        ) : users.length === 0 ? (
          <p className='text-sm text-slate-600'>No users found.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search users...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredUsers}
              keyExtractor={(item) => item.sub}
              renderActions={renderActions}
              nextCursor={paginationToken}
              onLoadMore={() => loadUsers(paginationToken ?? undefined)}
              isLoading={isLoading}
              emptyMessage={
                searchQuery.trim()
                  ? 'No users match your search.'
                  : 'No users found.'
              }
            />
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
            <h3 className='text-lg font-semibold text-slate-900'>
              Delete User
            </h3>
            <p className='mt-2 text-sm text-slate-600'>
              Are you sure you want to delete{' '}
              <span className='font-medium'>
                {deleteConfirm.email || deleteConfirm.username}
              </span>
              ?
            </p>
            <p className='mt-2 text-sm text-slate-600'>
              Any organizations they manage will be transferred to you as the fallback manager.
            </p>
            <p className='mt-2 text-sm font-medium text-red-600'>
              This action cannot be undone.
            </p>
            <div className='mt-6 flex justify-end gap-3'>
              <Button
                type='button'
                variant='secondary'
                onClick={() => setDeleteConfirm(null)}
                disabled={actionLoading === `delete-${deleteConfirm.sub}`}
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='danger'
                onClick={() => handleDeleteUser(deleteConfirm)}
                disabled={actionLoading === `delete-${deleteConfirm.sub}`}
              >
                {actionLoading === `delete-${deleteConfirm.sub}`
                  ? 'Deleting...'
                  : 'Delete User'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserAttributesModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

function UserAttributesModal({
  user,
  onClose,
}: {
  user: CognitoUser;
  onClose: () => void;
}) {
  const attributes = user.attributes ?? {};
  const attributeEntries = Object.entries(attributes).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'>
      <div className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-xl sm:p-6'>
        <div className='mb-4 flex items-start justify-between'>
          <h3 className='text-base font-semibold sm:text-lg'>
            User Attributes
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            aria-label='Close'
          >
            <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>

        <div className='space-y-4 text-sm'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <span className='font-medium text-slate-500'>Email</span>
              <p className='mt-1 break-all'>{user.email || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Username</span>
              <p className='mt-1 break-all'>{user.username || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Status</span>
              <p className='mt-1'>{user.status}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Groups</span>
              <p className='mt-1'>{user.groups?.join(', ') || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Created</span>
              <p className='mt-1'>{user.created_at || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Last Login</span>
              <p className='mt-1'>{user.last_auth_time || '—'}</p>
            </div>
          </div>

          <div>
            <span className='font-medium text-slate-500'>
              Raw Attributes
            </span>
            {attributeEntries.length === 0 ? (
              <p className='mt-1 text-slate-500'>No attributes found.</p>
            ) : (
              <pre className='mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700'>
                {JSON.stringify(attributes, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className='mt-6 flex justify-end'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
