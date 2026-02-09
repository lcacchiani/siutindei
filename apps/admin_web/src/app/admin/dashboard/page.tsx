'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AdminDashboard } from '../../../components/admin/admin-dashboard';
import { AuthProvider, useAuth } from '../../../components/auth-provider';
import { StatusBanner } from '../../../components/status-banner';

function DashboardGate() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

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
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Redirecting'>
          Sending you back to sign in.
        </StatusBanner>
      </main>
    );
  }

  return <AdminDashboard />;
}

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <DashboardGate />
    </AuthProvider>
  );
}
