'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  getOwnerStatus,
  type AccessRequest,
  type OwnerStatusResponse,
} from '../../lib/api-client';
import { useAuth } from '../auth-provider';
import { AppShell } from '../app-shell';
import { StatusBanner } from '../status-banner';
import { AccessRequestForm } from './access-request-form';
import { PendingRequestNotice } from './pending-request-notice';
import { OwnerOrganizationsPanel } from './owner-organizations-panel';
import { MediaPanel } from './media-panel';
import { LocationsPanel } from './locations-panel';
import { ActivitiesPanel } from './activities-panel';
import { PricingPanel } from './pricing-panel';
import { SchedulesPanel } from './schedules-panel';
import { useMemo } from 'react';

type OwnerView = 'loading' | 'request-form' | 'pending' | 'dashboard';

export function OwnerDashboard() {
  const { user, logout, error: authError } = useAuth();
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatusResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<OwnerView>('loading');
  const [pendingRequest, setPendingRequest] = useState<AccessRequest | null>(
    null
  );
  const [activeSection, setActiveSection] = useState('organizations');

  const loadOwnerStatus = async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await getOwnerStatus();
      setOwnerStatus(status);

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
    loadOwnerStatus();
  }, []);

  const handleRequestSubmitted = (request: AccessRequest) => {
    setPendingRequest(request);
    setView('pending');
  };

  // Sections available to owners (no "Add Organization" functionality)
  const sectionLabels = [
    { key: 'organizations', label: 'Organizations' },
    { key: 'media', label: 'Media' },
    { key: 'locations', label: 'Locations' },
    { key: 'activities', label: 'Activities' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'schedules', label: 'Schedules' },
  ];

  const activeContent = useMemo(() => {
    switch (activeSection) {
      case 'media':
        return <MediaPanel />;
      case 'locations':
        return <LocationsPanel />;
      case 'activities':
        return <ActivitiesPanel />;
      case 'pricing':
        return <PricingPanel />;
      case 'schedules':
        return <SchedulesPanel />;
      case 'organizations':
      default:
        return <OwnerOrganizationsPanel />;
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

  // Dashboard view (owner has organizations)
  return (
    <AppShell
      sections={sectionLabels}
      activeKey={activeSection}
      onSelect={setActiveSection}
      onLogout={logout}
      userEmail={user?.email}
    >
      {authError && (
        <StatusBanner variant='error' title='Session'>
          {authError}
        </StatusBanner>
      )}
      <StatusBanner variant='info' title='Owner View'>
        You are viewing as an organization owner. You can edit or delete your
        organizations but cannot create new ones. Contact an administrator if you
        need additional organizations.
      </StatusBanner>
      <div className='mt-4'>{activeContent}</div>
    </AppShell>
  );
}
