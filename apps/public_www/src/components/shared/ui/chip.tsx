import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly isSelected?: boolean;
}

export function Chip({
  children,
  isSelected = false,
  className = '',
  type = 'button',
  ...props
}: ChipProps) {
  const stateClassName = isSelected
    ? 'border-ink-900 bg-ink-900 text-white'
    : 'border-ink-900/15 bg-white text-ink-700 hover:border-ink-900/30';

  return (
    <button
      type={type}
      className={
        'inline-flex shrink-0 items-center rounded-full border px-4 ' +
        `py-2 text-sm font-medium transition ${stateClassName} ${className}`
      }
      {...props}
    >
      {children}
    </button>
  );
}
