'use client';

import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute('disabled')
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;
    if (container) {
      const focusable = getFocusableElements(container);
      focusable[0]?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = containerRef.current;
      if (!dialog) {
        return;
      }
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const confirmClassName =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : 'bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-500';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={containerRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'
      >
        <h2 id={titleId} className='text-lg font-semibold text-slate-900'>
          {title}
        </h2>
        <p className='mt-2 text-sm text-slate-600'>{message}</p>
        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500'
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
