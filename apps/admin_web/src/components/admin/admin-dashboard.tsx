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
import { AuditLogsPanel } from './audit-logs-panel';
import { CognitoUsersPanel } from './cognito-users-panel';
import { MediaPanel } from './media-panel';
import { ManagerDashboard } from './manager-dashboard';
import { UserDashboard } from './user-dashboard';

const sectionLabels = [
  { key: 'organizations', label: 'Organizations' },
  { key: 'media', label: 'Media' },
  { key: 'locations', label: 'Locations' },
  { key: 'activities', label: 'Activities' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'access-requests', label: 'Access Requests', dividerBefore: true },
  { key: 'cognito-users', label: 'Cognito Users' },
  { key: 'audit-logs', label: 'Audit Logs' },
];

export function AdminDashboard() {
  const { status, user, isAdmin, isManager, logout, error } = useAuth();
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
      case 'cognito-users':
        return <CognitoUsersPanel />;
      case 'audit-logs':
        return <AuditLogsPanel />;
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

  // If user is in the manager group but NOT in the admin group,
  // show the manager-specific experience
  if (isManager && !isAdmin) {
    return <ManagerDashboard />;
  }

  // If user is neither admin nor manager, show the user dashboard
  // where they can request to become a manager
  if (!isAdmin && !isManager) {
    return <UserDashboard />;
  }

  // Admin experience (full access)
  return (
    <AppShell
      sections={sectionLabels}
      activeKey={activeSection}
      onSelect={setActiveSection}
      onLogout={logout}
      userEmail={user?.email}
      lastAuthTime={user?.lastAuthTime}
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
