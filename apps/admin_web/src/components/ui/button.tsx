import type { ButtonHTMLAttributes } from 'react';

const baseStyles = 'btn';

const variantStyles = {
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary',
  ghost: 'btn-link',
  danger: 'btn-danger',
};

const sizeStyles = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${
        sizeStyles[size]
      } ${className}`}
      {...props}
    />
  );
}
