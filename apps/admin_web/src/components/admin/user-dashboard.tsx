'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  getUserAccessStatus,
  type AccessRequest,
  type ManagerStatusResponse,
} from '../../lib/api-client';
import { useAuth } from '../auth-provider';
import { AppShell } from '../app-shell';
import { StatusBanner } from '../status-banner';
import { AccessRequestForm } from './access-request-form';
import { PendingRequestNotice } from './pending-request-notice';

type UserView = 'loading' | 'request-form' | 'pending';

/**
 * Dashboard for regular logged-in users who are not yet managers or admins.
 * Allows them to submit a request to become a manager of an organization.
 */
export function UserDashboard() {
  const { user, logout, error: authError } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<UserView>('loading');
  const [pendingRequest, setPendingRequest] = useState<AccessRequest | null>(
    null
  );

  const loadUserStatus = async () => {
    setIsLoading(true);
    setError('');
    try {
      const status: ManagerStatusResponse = await getUserAccessStatus();

      if (status.has_pending_request && status.pending_request) {
        // User has a pending request
        setPendingRequest(status.pending_request);
        setView('pending');
      } else {
        // User has no pending request, show the request form
        setView('request-form');
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load your account status.';
      setError(message);
      // Show the request form even on error
      setView('request-form');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserStatus();
  }, []);

  const handleRequestSubmitted = (request: AccessRequest) => {
    setPendingRequest(request);
    setView('pending');
  };

  // Loading state
  if (view === 'loading' || isLoading) {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Loading'>
          Loading your account information...
        </StatusBanner>
      </main>
    );
  }

  // Pending request view
  if (view === 'pending' && pendingRequest) {
    return (
      <AppShell
        sections={[]}
        activeKey=''
        onSelect={() => {}}
        onLogout={logout}
        userEmail={user?.email}
        lastAuthTime={user?.lastAuthTime}
      >
        {authError && (
          <StatusBanner variant='error' title='Session'>
            {authError}
          </StatusBanner>
        )}
        <PendingRequestNotice request={pendingRequest} />
      </AppShell>
    );
  }

  // Request form view (default for regular users)
  return (
    <AppShell
      sections={[]}
      activeKey=''
      onSelect={() => {}}
      onLogout={logout}
      userEmail={user?.email}
      lastAuthTime={user?.lastAuthTime}
    >
      {authError && (
        <StatusBanner variant='error' title='Session'>
          {authError}
        </StatusBanner>
      )}
      {error && (
        <StatusBanner variant='error' title='Error'>
          {error}
        </StatusBanner>
      )}
      <AccessRequestForm onRequestSubmitted={handleRequestSubmitted} />
    </AppShell>
  );
}
