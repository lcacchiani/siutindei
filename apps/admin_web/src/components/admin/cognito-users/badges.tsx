'use client';

import type { ReactNode } from 'react';

import {
  AppleIcon,
  EmailIcon,
  GoogleIcon,
  MicrosoftIcon,
} from '../../icons/action-icons';

export function RoleBadge({
  role,
  isActive,
}: {
  role: 'admin' | 'manager';
  isActive: boolean;
}) {
  const colors = isActive
    ? role === 'admin'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

type IdentityProvider = 'Google' | 'Apple' | 'Microsoft' | 'Email';

function getIdentityProvider(
  username: string | null | undefined
): IdentityProvider {
  if (!username) return 'Email';
  const lowerUsername = username.toLowerCase();
  if (lowerUsername.startsWith('google_')) return 'Google';
  if (lowerUsername.startsWith('signinwithapple_')) return 'Apple';
  if (
    lowerUsername.startsWith('azuread_') ||
    lowerUsername.startsWith('microsoft_')
  ) {
    return 'Microsoft';
  }
  return 'Email';
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  );
}

export function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='2' y='7' width='20' height='14' rx='2' ry='2' />
      <path d='M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' />
    </svg>
  );
}

export function IdentityProviderBadge({
  username,
}: {
  username: string | null | undefined;
}) {
  const provider = getIdentityProvider(username);

  const icons: Record<IdentityProvider, ReactNode> = {
    Google: <GoogleIcon className='h-4 w-4' />,
    Apple: <AppleIcon className='h-4 w-4' />,
    Microsoft: <MicrosoftIcon className='h-4 w-4' />,
    Email: <EmailIcon className='h-4 w-4 text-slate-500' />,
  };

  return (
    <span title={provider} className='inline-flex items-center'>
      {icons[provider]}
    </span>
  );
}
