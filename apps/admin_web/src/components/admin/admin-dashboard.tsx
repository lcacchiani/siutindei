'use client';

import { useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { LoginScreen } from '@/components/login-screen';
import { StatusBanner } from '@/components/status-banner';
import { ActivitiesPanel } from '@/components/admin/activities-panel';
import { LocationsPanel } from '@/components/admin/locations-panel';
import { OrganizationsPanel } from '@/components/admin/organizations-panel';
import { PricingPanel } from '@/components/admin/pricing-panel';
import { SchedulesPanel } from '@/components/admin/schedules-panel';

const sectionLabels = [
  { key: 'organizations', label: 'Organizations' },
  { key: 'locations', label: 'Locations' },
  { key: 'activities', label: 'Activities' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'schedules', label: 'Schedules' },
];

export function AdminDashboard() {
  const { status, user, isAdmin, logout, error } = useAuth();
  const [activeSection, setActiveSection] = useState('organizations');

  const activeContent = useMemo(() => {
    switch (activeSection) {
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
        return <OrganizationsPanel />;
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
      {!isAdmin && (
        <StatusBanner variant='error' title='Access denied'>
          Your account is not in the admin group.
        </StatusBanner>
      )}
      {isAdmin && activeContent}
    </AppShell>
  );
}
