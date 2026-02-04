'use client';

import type { ReactNode } from 'react';

const variantStyles = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export interface StatusBannerProps {
  variant: 'info' | 'error' | 'success';
  title: string;
  children: ReactNode;
}

export function StatusBanner({
  variant,
  title,
  children,
}: StatusBannerProps) {
  return (
    <div
      className={`w-full rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 ${variantStyles[variant]}`}
    >
      <p className='text-xs font-semibold sm:text-sm'>{title}</p>
      <p className='mt-1 text-xs sm:text-sm'>{children}</p>
    </div>
  );
}
