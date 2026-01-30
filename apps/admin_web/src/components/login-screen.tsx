'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBanner } from '@/components/status-banner';
import { useAuth } from '@/components/auth-provider';

export function LoginScreen() {
  const { login, configErrors } = useAuth();
  const hasConfigErrors = configErrors.length > 0;

  return (
    <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
      <Card
        title='Admin sign in'
        description='Sign in with your admin account to manage entries.'
        className='w-full'
      >
        {hasConfigErrors && (
          <div className='mb-4 space-y-2'>
            {configErrors.map((error) => (
              <StatusBanner key={error} variant='error' title='Config'>
                {error}
              </StatusBanner>
            ))}
          </div>
        )}
        <Button
          type='button'
          onClick={login}
          disabled={hasConfigErrors}
          className='w-full'
        >
          Continue to login
        </Button>
        <p className='mt-3 text-sm text-slate-600'>
          You must be in the admin group to access management tools.
        </p>
      </Card>
    </main>
  );
}
