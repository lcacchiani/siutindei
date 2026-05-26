import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 ' +
    'border border-accent-500',
  secondary:
    'bg-white text-ink-900 hover:bg-brand-50 ' +
    'border border-ink-900/15',
  ghost: 'bg-transparent text-ink-700 hover:bg-brand-50 border border-transparent',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const baseClassName =
    'inline-flex min-h-11 items-center justify-center rounded-lg ' +
    'px-4 text-sm font-semibold transition disabled:cursor-not-allowed ' +
    'disabled:opacity-50';

  return (
    <button
      type={type}
      className={`${baseClassName} ${variantClassNames[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
