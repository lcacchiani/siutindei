import type { ReactNode } from 'react';

const variantStyles = {
  info: 'alert-info',
  error: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
};

export interface StatusBannerProps {
  variant: 'info' | 'error' | 'success' | 'warning';
  title: string;
  children: ReactNode;
}

export function StatusBanner({
  variant,
  title,
  children,
}: StatusBannerProps) {
  return (
    <div className={`alert ${variantStyles[variant]} mb-0`} role='alert'>
      <div className='fw-semibold'>{title}</div>
      <div className='small'>{children}</div>
    </div>
  );
}
