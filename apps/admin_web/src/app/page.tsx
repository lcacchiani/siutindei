'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AuthProvider, useAuth } from '../components/auth-provider';
import { LoginScreen } from '../components/login-screen';
import { StatusBanner } from '../components/status-banner';

function LoginGate() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/admin/dashboard/');
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

  if (status === 'authenticated') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Redirecting'>
          Sending you to the dashboard.
        </StatusBanner>
      </main>
    );
  }

  return <LoginScreen />;
}

export default function HomePage() {
  return (
    <AuthProvider>
      <LoginGate />
    </AuthProvider>
  );
}
