'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from './auth-provider';
import { StatusBanner } from './status-banner';

interface AuthGateProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function AuthGate({ children, requireAuth = true }: AuthGateProps) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (requireAuth && status === 'unauthenticated') {
      router.replace('/');
    }
    if (!requireAuth && status === 'authenticated') {
      router.replace('/admin/dashboard');
    }
  }, [requireAuth, router, status]);

  if (status === 'loading') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Loading'>
          Preparing your admin session.
        </StatusBanner>
      </main>
    );
  }

  if (requireAuth && status === 'unauthenticated') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Redirecting'>
          Sending you back to sign in.
        </StatusBanner>
      </main>
    );
  }

  if (!requireAuth && status === 'authenticated') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Redirecting'>
          Sending you to the dashboard.
        </StatusBanner>
      </main>
    );
  }

  return <>{children}</>;
}
