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
import { Button } from '../ui/button';
import { Card } from '../ui/card';
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF"/>
      <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900"/>
      <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022"/>
      <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00"/>
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IdentityProviderBadge({ username }: { username: string | null | undefined }) {
  const provider = getIdentityProvider(username);

  const icons: Record<IdentityProvider, React.ReactNode> = {
    Google: <GoogleIcon className="h-4 w-4" />,
    Apple: <AppleIcon className="h-4 w-4" />,
    Microsoft: <MicrosoftIcon className="h-4 w-4" />,
    Email: <EmailIcon className="h-4 w-4 text-slate-500" />,
  };

  return (
    <span title={provider} className="inline-flex items-center">
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

  return (
    <div className='space-y-6'>
      <Card
        title='Cognito Users'
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
                  <th className='py-2'>Roles</th>
                  <th className='py-2'>Last Login</th>
                  <th className='py-2'>Created</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((cognitoUser) => {
                  const hasAdminRole = cognitoUser.groups?.includes('admin') || false;
                  const hasManagerRole = cognitoUser.groups?.includes('manager') || false;
                  const isCurrent = isCurrentUser(cognitoUser);

                  return (
                    <tr key={cognitoUser.sub} className='border-b border-slate-100'>
                      <td className='py-2'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>
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
                      </td>
                      <td className='py-2'>
                        <div className='flex gap-1'>
                          <RoleBadge role='admin' isActive={hasAdminRole} />
                          <RoleBadge role='manager' isActive={hasManagerRole} />
                        </div>
                      </td>
                      <td className='py-2 text-slate-600'>
                        {formatDateTime(cognitoUser.last_auth_time)}
                      </td>
                      <td className='py-2 text-slate-600'>
                        {formatDate(cognitoUser.created_at)}
                      </td>
                      <td className='py-2 text-right'>
                        {isCurrent ? (
                          <span className='text-xs text-slate-400'>
                            Cannot modify your own account
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
                              variant={hasManagerRole ? 'danger' : 'secondary'}
                              onClick={() =>
                                handleToggleRole(cognitoUser, 'manager', hasManagerRole)
                              }
                              disabled={actionLoading === `${cognitoUser.sub}-manager`}
                            >
                              {actionLoading === `${cognitoUser.sub}-manager`
                                ? '...'
                                : hasManagerRole
                                  ? 'Remove Manager'
                                  : 'Make Manager'}
                            </Button>
                            <Button
                              type='button'
                              size='sm'
                              variant='danger'
                              onClick={() => setDeleteConfirm(cognitoUser)}
                              disabled={actionLoading === `delete-${cognitoUser.sub}`}
                              title='Delete'
                            >
                              {actionLoading === `delete-${cognitoUser.sub}`
                                ? '...'
                                : <DeleteIcon className='h-4 w-4' />}
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
                const hasManagerRole = cognitoUser.groups?.includes('manager') || false;
                const isCurrent = isCurrentUser(cognitoUser);

                return (
                  <div
                    key={cognitoUser.sub}
                    className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate font-medium text-slate-900'>
                          {cognitoUser.email || cognitoUser.username || 'Unknown'}
                        </span>
                        <IdentityProviderBadge username={cognitoUser.username} />
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
                    <div className='mt-2 flex items-center justify-between text-sm'>
                      <div className='flex gap-1'>
                        <RoleBadge role='admin' isActive={hasAdminRole} />
                        <RoleBadge role='manager' isActive={hasManagerRole} />
                      </div>
                      <span className='text-slate-500'>
                        Created: {formatDate(cognitoUser.created_at)}
                      </span>
                    </div>
                    {cognitoUser.last_auth_time && (
                      <div className='mt-1 text-xs text-slate-500'>
                        Last login: {formatDateTime(cognitoUser.last_auth_time)}
                      </div>
                    )}
                    <div className='mt-3 border-t border-slate-200 pt-3'>
                      {isCurrent ? (
                        <span className='block text-center text-xs text-slate-400'>
                          Cannot modify your own account
                        </span>
                      ) : (
                        <div className='space-y-2'>
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
                              variant={hasManagerRole ? 'danger' : 'secondary'}
                              onClick={() =>
                                handleToggleRole(cognitoUser, 'manager', hasManagerRole)
                              }
                              disabled={actionLoading === `${cognitoUser.sub}-manager`}
                              className='flex-1'
                            >
                              {actionLoading === `${cognitoUser.sub}-manager`
                                ? '...'
                                : hasManagerRole
                                  ? 'Remove Manager'
                                  : 'Make Manager'}
                            </Button>
                          </div>
                          <Button
                            type='button'
                            size='sm'
                            variant='danger'
                            onClick={() => setDeleteConfirm(cognitoUser)}
                            disabled={actionLoading === `delete-${cognitoUser.sub}`}
                            className='w-full'
                            title='Delete User'
                          >
                            {actionLoading === `delete-${cognitoUser.sub}`
                              ? '...'
                              : <DeleteIcon className='h-4 w-4' />}
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
    </div>
  );
}
