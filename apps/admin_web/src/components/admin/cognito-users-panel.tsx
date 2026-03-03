'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
} from '../../lib/api-client';
import {
  addUserToGroup,
  deleteCognitoUser,
  listCognitoUsers,
  removeUserFromGroup,
  type CognitoUsersResponse,
} from '../../lib/api-client-cognito';
import { formatDate, formatDateTime } from '../../lib/date-utils';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
import type { CognitoUser } from '../../types/admin';
import { useAuth } from '../auth-provider';
import {
  DeleteIcon,
  ViewIcon,
} from '../icons/action-icons';
import {
  BriefcaseIcon,
  IdentityProviderBadge,
  RoleBadge,
  ShieldIcon,
} from './cognito-users/badges';
import { UserAttributesModal } from './cognito-users/user-attributes-modal';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { SearchInput } from '../ui/search-input';
import { StatusBanner } from '../status-banner';

export function CognitoUsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [paginationToken, setPaginationToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

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

  const requestDeleteUser = async (targetUser: CognitoUser) => {
    const identifier = targetUser.email || targetUser.username || 'this user';
    const confirmed = await confirm(
      'Delete user?',
      `Delete ${identifier}? This action cannot be undone.`,
      { variant: 'danger', confirmLabel: 'Delete User' }
    );
    if (!confirmed) {
      return;
    }
    await handleDeleteUser(targetUser);
  };

  const isCurrentUser = useCallback(
    (cognitoUser: CognitoUser) => currentUser?.subject === cognitoUser.sub,
    [currentUser?.subject]
  );

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

  const columns = useMemo(
    () => [
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
    ],
    [isCurrentUser]
  );

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
          onClick={() => {
            void requestDeleteUser(cognitoUser);
          }}
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
      {confirmDialog}

      {selectedUser && (
        <UserAttributesModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
