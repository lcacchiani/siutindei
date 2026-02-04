'use client';

import { useState } from 'react';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { StatusBanner } from './status-banner';
import { useAuth } from './auth-provider';

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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendPasswordlessCode(email);
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyPasswordlessCode(code);
  };

  const handleBackToEmail = () => {
    resetPasswordless();
    setCode('');
  };

  return (
    <main className='mx-auto flex min-h-screen max-w-lg items-center px-4 py-8 sm:px-6'>
      <Card
        title='Admin sign in'
        description='Sign in with your email or social account to manage entries.'
        className='w-full'
      >
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
              <StatusBanner key={configError} variant='error' title='Config'>
                {configError}
              </StatusBanner>
            ))}
          </div>
        )}

        {/* Passwordless Email Login */}
        {!showCodeInput ? (
          <form onSubmit={handleEmailSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email address</Label>
              <Input
                id='email'
                type='email'
                placeholder='you@example.com'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || hasConfigErrors}
                required
                autoComplete='email'
                autoFocus
              />
            </div>
            <Button
              type='submit'
              disabled={isLoading || hasConfigErrors || !email.trim()}
              className='h-11 w-full text-base sm:h-10 sm:text-sm'
            >
              {isSending ? 'Sending code...' : 'Email me a sign-in code'}
            </Button>
            <p className='text-center text-xs text-slate-600 sm:text-sm'>
              We&apos;ll send a one-time code to your email.
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
                onChange={(e) => setCode(e.target.value)}
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
              className='h-11 w-full text-base sm:h-10 sm:text-sm'
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

        {/* Divider */}
        <div className='relative my-6'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-slate-200' />
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='bg-white px-4 text-slate-500'>
              Or continue with
            </span>
          </div>
        </div>

        {/* Social Login */}
        <Button
          type='button'
          variant='outline'
          onClick={login}
          disabled={hasConfigErrors || isLoading}
          className='h-11 w-full text-base sm:h-10 sm:text-sm'
        >
          Sign in with Google, Apple, or Microsoft
        </Button>

        <p className='mt-4 text-center text-xs text-slate-600 sm:text-sm'>
          You must be in the admin or manager group to access management tools.
        </p>
      </Card>
    </main>
  );
}
