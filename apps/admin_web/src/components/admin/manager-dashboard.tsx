'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  getManagerStatus,
  type AccessRequest,
  type ManagerStatusResponse,
} from '../../lib/api-client';
import { useAuth } from '../auth-provider';
import { AppShell } from '../app-shell';
import { StatusBanner } from '../status-banner';
import {
  OrganizationsPanel,
  LocationsPanel,
  ActivitiesPanel,
  PricingPanel,
  SchedulesPanel,
} from '../shared';
import { AccessRequestForm } from './access-request-form';
import { PendingRequestNotice } from './pending-request-notice';
import { MediaPanel } from './media-panel';

type ManagerView = 'loading' | 'request-form' | 'pending' | 'dashboard';

export function ManagerDashboard() {
  const { user, logout, error: authError } = useAuth();
  const [managerStatus, setManagerStatus] = useState<ManagerStatusResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ManagerView>('loading');
  const [pendingRequest, setPendingRequest] = useState<AccessRequest | null>(
    null
  );
  const [activeSection, setActiveSection] = useState('organizations');

  const loadManagerStatus = async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await getManagerStatus();
      setManagerStatus(status);

      if (status.organizations_count > 0) {
        // User has organizations, show the dashboard
        setView('dashboard');
      } else if (status.has_pending_request && status.pending_request) {
        // User has a pending request
        setPendingRequest(status.pending_request);
        setView('pending');
      } else {
        // User has no organizations and no pending request
        setView('request-form');
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load your account status.';
      setError(message);
      setView('request-form');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadManagerStatus();
  }, []);

  const handleRequestSubmitted = (request: AccessRequest) => {
    setPendingRequest(request);
    setView('pending');
  };

  // Sections available to managers
  const sectionLabels = [
    { key: 'organizations', label: 'Organizations' },
    { key: 'media', label: 'Media' },
    { key: 'locations', label: 'Locations' },
    { key: 'activities', label: 'Activities' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'schedules', label: 'Schedules' },
  ];

  // Use shared components with mode='manager'
  const activeContent = useMemo(() => {
    switch (activeSection) {
      case 'media':
        return <MediaPanel />;
      case 'locations':
        return <LocationsPanel mode='manager' />;
      case 'activities':
        return <ActivitiesPanel mode='manager' />;
      case 'pricing':
        return <PricingPanel mode='manager' />;
      case 'schedules':
        return <SchedulesPanel mode='manager' />;
      case 'organizations':
      default:
        return <OrganizationsPanel mode='manager' />;
    }
  }, [activeSection]);

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

  // Error state with request form fallback
  if (error && view === 'request-form') {
    return (
      <AppShell
        sections={[]}
        activeKey=''
        onSelect={() => {}}
        onLogout={logout}
        userEmail={user?.email}
        lastAuthTime={user?.lastAuthTime}
      >
        <StatusBanner variant='error' title='Error'>
          {error}
        </StatusBanner>
        <div className='mt-6'>
          <AccessRequestForm onRequestSubmitted={handleRequestSubmitted} />
        </div>
      </AppShell>
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

  // Request form view (no organizations, no pending request)
  if (view === 'request-form') {
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
        <AccessRequestForm onRequestSubmitted={handleRequestSubmitted} />
      </AppShell>
    );
  }

  // Dashboard view (manager has organizations)
  return (
    <AppShell
      sections={sectionLabels}
      activeKey={activeSection}
      onSelect={setActiveSection}
      onLogout={logout}
      userEmail={user?.email}
      lastAuthTime={user?.lastAuthTime}
    >
      {authError && (
        <StatusBanner variant='error' title='Session'>
          {authError}
        </StatusBanner>
      )}
      <StatusBanner variant='info' title='Manager View'>
        You are viewing as an organization manager. You can edit or delete your
        organizations but cannot create new ones. Contact an administrator if you
        need additional organizations.
      </StatusBanner>
      <div className='mt-4'>{activeContent}</div>
    </AppShell>
  );
}
