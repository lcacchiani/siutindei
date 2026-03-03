'use client';

import { useEffect, useId, useRef } from 'react';

import type { CognitoUser } from '../../../types/admin';
import { Button } from '../../ui/button';

interface UserAttributesModalProps {
  user: CognitoUser;
  onClose: () => void;
}

export function UserAttributesModal({ user, onClose }: UserAttributesModalProps) {
  const attributes = user.attributes ?? {};
  const attributeEntries = Object.entries(attributes).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));
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
  }, [onClose]);

  return (
    <div
      className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-xl sm:p-6'
      >
        <div className='mb-4 flex items-start justify-between'>
          <h3 id={titleId} className='text-base font-semibold sm:text-lg'>
            User Attributes
          </h3>
          <button
            ref={closeButtonRef}
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            aria-label='Close'
          >
            <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>

        <div className='space-y-4 text-sm'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <span className='font-medium text-slate-500'>Email</span>
              <p className='mt-1 break-all'>{user.email || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Username</span>
              <p className='mt-1 break-all'>{user.username || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Status</span>
              <p className='mt-1'>{user.status}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Groups</span>
              <p className='mt-1'>{user.groups?.join(', ') || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Created</span>
              <p className='mt-1'>{user.created_at || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Last Login</span>
              <p className='mt-1'>{user.last_auth_time || '—'}</p>
            </div>
          </div>

          <div>
            <span className='font-medium text-slate-500'>Raw Attributes</span>
            {attributeEntries.length === 0 ? (
              <p className='mt-1 text-slate-500'>No attributes found.</p>
            ) : (
              <pre className='mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700'>
                {JSON.stringify(attributes, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className='mt-6 flex justify-end'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
