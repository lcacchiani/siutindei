'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  listCognitoUsers,
  addUserToGroup,
  removeUserFromGroup,
  type CognitoUsersResponse,
} from '../../lib/api-client';
import type { CognitoUser } from '../../types/admin';
import { useAuth } from '../auth-provider';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SearchInput } from '../ui/search-input';
import { StatusBanner } from '../status-banner';

function RoleBadge({
  role,
  isActive,
}: {
  role: 'admin' | 'owner';
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

function UserStatusBadge({ status }: { status: string | null | undefined }) {
  const statusColors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800',
    UNCONFIRMED: 'bg-yellow-100 text-yellow-800',
    FORCE_CHANGE_PASSWORD: 'bg-orange-100 text-orange-800',
    DISABLED: 'bg-red-100 text-red-800',
  };

  const color = status ? statusColors[status] || 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {status || 'Unknown'}
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
          : 'Failed to load Cognito users.';
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
    role: 'admin' | 'owner',
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

  return (
    <div className='space-y-6'>
      <Card
        title='Cognito Users'
        description='Manage user roles across all identity providers (Google, Apple, Microsoft). Promote or demote users to Admin or Owner roles.'
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
            {filteredUsers.length === 0 ? (
              <p className='text-sm text-slate-600'>No users match your search.</p>
            ) : (
            <>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto lg:block'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Email</th>
                  <th className='py-2'>Status</th>
                  <th className='py-2'>Roles</th>
                  <th className='py-2'>Created</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((cognitoUser) => {
                  const hasAdminRole = cognitoUser.groups?.includes('admin') || false;
                  const hasOwnerRole = cognitoUser.groups?.includes('owner') || false;
                  const isCurrent = isCurrentUser(cognitoUser);

                  return (
                    <tr key={cognitoUser.sub} className='border-b border-slate-100'>
                      <td className='py-2'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>
                            {cognitoUser.email || cognitoUser.username || 'Unknown'}
                          </span>
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
                      </td>
                      <td className='py-2'>
                        <UserStatusBadge status={cognitoUser.status} />
                      </td>
                      <td className='py-2'>
                        <div className='flex gap-1'>
                          <RoleBadge role='admin' isActive={hasAdminRole} />
                          <RoleBadge role='owner' isActive={hasOwnerRole} />
                        </div>
                      </td>
                      <td className='py-2 text-slate-600'>
                        {formatDate(cognitoUser.created_at)}
                      </td>
                      <td className='py-2 text-right'>
                        {isCurrent ? (
                          <span className='text-xs text-slate-400'>
                            Cannot modify your own roles
                          </span>
                        ) : (
                          <div className='flex justify-end gap-2'>
                            <Button
                              type='button'
                              size='sm'
                              variant={hasAdminRole ? 'danger' : 'secondary'}
                              onClick={() =>
                                handleToggleRole(cognitoUser, 'admin', hasAdminRole)
                              }
                              disabled={actionLoading === `${cognitoUser.sub}-admin`}
                            >
                              {actionLoading === `${cognitoUser.sub}-admin`
                                ? '...'
                                : hasAdminRole
                                  ? 'Remove Admin'
                                  : 'Make Admin'}
                            </Button>
                            <Button
                              type='button'
                              size='sm'
                              variant={hasOwnerRole ? 'danger' : 'secondary'}
                              onClick={() =>
                                handleToggleRole(cognitoUser, 'owner', hasOwnerRole)
                              }
                              disabled={actionLoading === `${cognitoUser.sub}-owner`}
                            >
                              {actionLoading === `${cognitoUser.sub}-owner`
                                ? '...'
                                : hasOwnerRole
                                  ? 'Remove Owner'
                                  : 'Make Owner'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile/tablet card view */}
            <div className='space-y-3 lg:hidden'>
              {filteredUsers.map((cognitoUser) => {
                const hasAdminRole = cognitoUser.groups?.includes('admin') || false;
                const hasOwnerRole = cognitoUser.groups?.includes('owner') || false;
                const isCurrent = isCurrentUser(cognitoUser);

                return (
                  <div
                    key={cognitoUser.sub}
                    className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='truncate font-medium text-slate-900'>
                            {cognitoUser.email || cognitoUser.username || 'Unknown'}
                          </span>
                          {isCurrent && (
                            <span className='shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600'>
                              You
                            </span>
                          )}
                        </div>
                        {cognitoUser.name && (
                          <div className='mt-0.5 text-sm text-slate-500'>
                            {cognitoUser.name}
                          </div>
                        )}
                      </div>
                      <UserStatusBadge status={cognitoUser.status} />
                    </div>
                    <div className='mt-2 flex items-center justify-between text-sm'>
                      <div className='flex gap-1'>
                        <RoleBadge role='admin' isActive={hasAdminRole} />
                        <RoleBadge role='owner' isActive={hasOwnerRole} />
                      </div>
                      <span className='text-slate-500'>
                        {formatDate(cognitoUser.created_at)}
                      </span>
                    </div>
                    <div className='mt-3 border-t border-slate-200 pt-3'>
                      {isCurrent ? (
                        <span className='block text-center text-xs text-slate-400'>
                          Cannot modify your own roles
                        </span>
                      ) : (
                        <div className='flex gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant={hasAdminRole ? 'danger' : 'secondary'}
                            onClick={() =>
                              handleToggleRole(cognitoUser, 'admin', hasAdminRole)
                            }
                            disabled={actionLoading === `${cognitoUser.sub}-admin`}
                            className='flex-1'
                          >
                            {actionLoading === `${cognitoUser.sub}-admin`
                              ? '...'
                              : hasAdminRole
                                ? 'Remove Admin'
                                : 'Make Admin'}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant={hasOwnerRole ? 'danger' : 'secondary'}
                            onClick={() =>
                              handleToggleRole(cognitoUser, 'owner', hasOwnerRole)
                            }
                            disabled={actionLoading === `${cognitoUser.sub}-owner`}
                            className='flex-1'
                          >
                            {actionLoading === `${cognitoUser.sub}-owner`
                              ? '...'
                              : hasOwnerRole
                                ? 'Remove Owner'
                                : 'Make Owner'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {paginationToken && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => loadUsers(paginationToken)}
                  disabled={isLoading}
                  className='w-full sm:w-auto'
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
