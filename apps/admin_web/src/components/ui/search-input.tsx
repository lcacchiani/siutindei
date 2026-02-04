'use client';

import type { InputHTMLAttributes } from 'react';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SearchInput({
  className = '',
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <SearchIcon className="text-slate-400" />
      </div>
      <input
        type="text"
        className={
          'h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-base ' +
          'text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 ' +
          'focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed ' +
          `disabled:bg-slate-100 sm:h-9 sm:text-sm ${className}`
        }
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
}
