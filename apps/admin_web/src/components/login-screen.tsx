'use client';

import { useState, type FormEvent } from 'react';

import { useAuth } from './auth-provider';
import {
  AppleIcon,
  GoogleIcon,
  MicrosoftIcon,
} from './icons/action-icons';
import { StatusBanner } from './status-banner';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

const socialProviders = [
  {
    key: 'google',
    label: 'Continue with Google',
    provider: 'Google',
    Icon: GoogleIcon,
  },
  {
    key: 'apple',
    label: 'Continue with Apple',
    provider: 'SignInWithApple',
    Icon: AppleIcon,
  },
  {
    key: 'microsoft',
    label: 'Continue with Microsoft',
    provider: 'Microsoft',
    Icon: MicrosoftIcon,
  },
] as const;

export function LoginScreen() {
  const {
    login,
    configErrors,
    error,
    passwordlessStatus,
    passwordlessError,
    passwordlessEmail,
    sendPasswordlessCode,
    verifyPasswordlessCode,
    resetPasswordless,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const hasConfigErrors = configErrors.length > 0;
  const hasError = error.length > 0;
  const hasPasswordlessError = passwordlessError.length > 0;

  const isSending = passwordlessStatus === 'sending';
  const isVerifying = passwordlessStatus === 'verifying';
  const isLoading = isSending || isVerifying;
  const showCodeInput =
    passwordlessStatus === 'challenge' || passwordlessStatus === 'verifying';

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendPasswordlessCode(email);
  };

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await verifyPasswordlessCode(code);
  };

  const handleBackToEmail = () => {
    resetPasswordless();
    setCode('');
  };

  const handleProviderLogin = (provider: string) => {
    void login({ provider, returnTo: '/admin/dashboard' });
  };

  return (
    <main className='min-h-screen bg-slate-50'>
      <div className='mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]'>
        <section className='relative hidden flex-col justify-between overflow-hidden bg-slate-900 text-white lg:flex'>
          <div className='absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700' />
          <div className='relative z-10 p-10'>
            <p className='text-xs font-semibold uppercase tracking-[0.3em] text-slate-300'>
              Siu Tin Dei
            </p>
            <h2 className='mt-4 text-3xl font-semibold leading-tight'>
              Admin console access
            </h2>
            <p className='mt-4 text-sm text-slate-200'>
              Manage organizations, activities, and schedules with secure
              sign-in and audit-ready tools.
            </p>
            <ul className='mt-6 space-y-3 text-sm text-slate-200'>
              <li className='flex items-start gap-3'>
                <span className='mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300' />
                Review updates, approvals, and access requests in one place.
              </li>
              <li className='flex items-start gap-3'>
                <span className='mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300' />
                Track changes with audit logs and real-time status updates.
              </li>
              <li className='flex items-start gap-3'>
                <span className='mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300' />
                Keep teams aligned with role-based access controls.
              </li>
            </ul>
          </div>
          <div className='relative z-10 p-10 text-xs text-slate-300'>
            Need access? Use your organization email or contact support.
          </div>
        </section>

        <section className='flex items-center justify-center px-6 py-10 sm:px-10'>
          <div className='w-full max-w-md'>
            <div className='mb-6 space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.3em] text-slate-500'>
                Siu Tin Dei Admin
              </p>
              <h1 className='text-2xl font-semibold text-slate-900'>
                Welcome back
              </h1>
              <p className='text-sm text-slate-600'>
                Sign in with social accounts or request a magic link by email.
              </p>
            </div>

            <Card className='w-full'>
              {(hasError || hasConfigErrors || hasPasswordlessError) && (
                <div className='mb-4 space-y-2'>
                  {hasError && (
                    <StatusBanner variant='error' title='Login'>
                      {error}
                    </StatusBanner>
                  )}
                  {hasPasswordlessError && (
                    <StatusBanner variant='error' title='Email sign in'>
                      {passwordlessError}
                    </StatusBanner>
                  )}
                  {configErrors.map((configError) => (
                    <StatusBanner
                      key={configError}
                      variant='error'
                      title='Config'
                    >
                      {configError}
                    </StatusBanner>
                  ))}
                </div>
              )}

              <div className='space-y-3'>
                {socialProviders.map(({ key, label, provider, Icon }) => (
                  <Button
                    key={key}
                    type='button'
                    variant='outline'
                    onClick={() => handleProviderLogin(provider)}
                    disabled={hasConfigErrors || isLoading}
                    className='h-11 w-full justify-start gap-3 text-sm font-semibold'
                  >
                    <span
                      aria-hidden='true'
                      className='flex h-5 w-5 items-center justify-center'
                    >
                      <Icon className='h-5 w-5' />
                    </span>
                    {label}
                  </Button>
                ))}
              </div>

              <div className='relative my-6'>
                <div className='absolute inset-0 flex items-center'>
                  <div className='w-full border-t border-slate-200' />
                </div>
                <div className='relative flex justify-center text-xs uppercase tracking-[0.3em] text-slate-500'>
                  <span className='bg-white px-3'>Or</span>
                </div>
              </div>

              {!showCodeInput ? (
                <form onSubmit={handleEmailSubmit} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Work email</Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='you@example.com'
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isLoading || hasConfigErrors}
                      required
                      autoComplete='email'
                      autoFocus
                    />
                  </div>
                  <Button
                    type='submit'
                    disabled={isLoading || hasConfigErrors || !email.trim()}
                    className='h-11 w-full text-base sm:text-sm'
                  >
                    {isSending ? 'Sending link...' : 'Email me a magic link'}
                  </Button>
                  <p className='text-center text-xs text-slate-600'>
                    We&apos;ll send a one-time code if links are blocked.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleCodeSubmit} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='code'>Verification code</Label>
                    <Input
                      id='code'
                      type='text'
                      inputMode='numeric'
                      pattern='[0-9]*'
                      placeholder='123456'
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete='one-time-code'
                      autoFocus
                    />
                    <p className='text-xs text-slate-600'>
                      Enter the 6-digit code sent to{' '}
                      <span className='font-medium'>{passwordlessEmail}</span>
                    </p>
                  </div>
                  <Button
                    type='submit'
                    disabled={isLoading || !code.trim()}
                    className='h-11 w-full text-base sm:text-sm'
                  >
                    {isVerifying ? 'Verifying...' : 'Verify code'}
                  </Button>
                  <button
                    type='button'
                    onClick={handleBackToEmail}
                    disabled={isLoading}
                    className='w-full text-center text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50'
                  >
                    Use a different email
                  </button>
                </form>
              )}

              <p className='mt-6 text-center text-xs text-slate-600'>
                You must be in the admin or manager group to access tools.
              </p>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
