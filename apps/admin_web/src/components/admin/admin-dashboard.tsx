'use client';

import { useMemo, useState } from 'react';

import { AppShell } from '../app-shell';
import { useAuth } from '../auth-provider';
import { LoginScreen } from '../login-screen';
import { StatusBanner } from '../status-banner';
import {
  OrganizationsPanel,
  LocationsPanel,
  ActivitiesPanel,
  PricingPanel,
  SchedulesPanel,
} from '../shared';
import { AccessRequestsPanel } from './access-requests-panel';
import { MediaPanel } from './media-panel';
import { OwnerDashboard } from './owner-dashboard';

const sectionLabels = [
  { key: 'organizations', label: 'Organizations' },
  { key: 'media', label: 'Media' },
  { key: 'locations', label: 'Locations' },
  { key: 'activities', label: 'Activities' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'access-requests', label: 'Access Requests' },
];

export function AdminDashboard() {
  const { status, user, isAdmin, isOwner, logout, error } = useAuth();
  const [activeSection, setActiveSection] = useState('organizations');

  const activeContent = useMemo(() => {
    switch (activeSection) {
      case 'media':
        return <MediaPanel />;
      case 'locations':
        return <LocationsPanel mode='admin' />;
      case 'activities':
        return <ActivitiesPanel mode='admin' />;
      case 'pricing':
        return <PricingPanel mode='admin' />;
      case 'schedules':
        return <SchedulesPanel mode='admin' />;
      case 'access-requests':
        return <AccessRequestsPanel />;
      case 'organizations':
      default:
        return <OrganizationsPanel mode='admin' />;
    }
  }, [activeSection]);

  if (status === 'loading') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Loading'>
          Preparing your admin session.
        </StatusBanner>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  // If user is in the owner group but NOT in the admin group,
  // show the owner-specific experience
  if (isOwner && !isAdmin) {
    return <OwnerDashboard />;
  }

  // If user is neither admin nor owner, show access denied
  if (!isAdmin && !isOwner) {
    return (
      <AppShell
        sections={[]}
        activeKey=''
        onSelect={() => {}}
        onLogout={logout}
        userEmail={user?.email}
      >
        <StatusBanner variant='error' title='Access denied'>
          Your account is not authorized to access this system. Please contact
          an administrator to request access.
        </StatusBanner>
      </AppShell>
    );
  }

  // Admin experience (full access)
  return (
    <AppShell
      sections={sectionLabels}
      activeKey={activeSection}
      onSelect={setActiveSection}
      onLogout={logout}
      userEmail={user?.email}
    >
      {error && (
        <StatusBanner variant='error' title='Session'>
          {error}
        </StatusBanner>
      )}
      {activeContent}
    </AppShell>
  );
}
