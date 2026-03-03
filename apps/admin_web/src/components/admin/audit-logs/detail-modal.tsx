'use client';

import { useEffect, useId, useRef } from 'react';

import { formatDateTime } from '../../../lib/date-utils';
import type { AuditLog } from '../../../types/admin';
import { Button } from '../../ui/button';

export function ActionBadge({ action }: { action: AuditLog['action'] }) {
  const colors = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[action]}`}
    >
      {action}
    </span>
  );
}

export function SourceBadge({ source }: { source: AuditLog['source'] }) {
  const colors: Record<string, string> = {
    trigger: 'bg-slate-100 text-slate-700',
    application: 'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[source] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {source}
    </span>
  );
}

interface DetailModalProps {
  log: AuditLog;
  onClose: () => void;
  userEmailById: Record<string, string>;
}

function formatJson(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '—';
  return JSON.stringify(obj, null, 2);
}

export function DetailModal({ log, onClose, userEmailById }: DetailModalProps) {
  const userEmail = log.user_id ? userEmailById[log.user_id] : null;
  const dialogRef = useRef<HTMLDivElement>(null);
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
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
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
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-xl sm:p-6'
      >
        <div className='mb-4 flex items-start justify-between'>
          <h3 id={titleId} className='text-base font-semibold sm:text-lg'>
            Audit Log Detail
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

        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='font-medium text-slate-500'>ID</span>
              <p className='mt-1 break-all font-mono text-xs'>{log.id}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Timestamp</span>
              <p className='mt-1'>{formatDateTime(log.timestamp)}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Table</span>
              <p className='mt-1'>{log.table_name}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Record ID</span>
              <p className='mt-1 break-all font-mono text-xs'>{log.record_id}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Action</span>
              <p className='mt-1'>
                <ActionBadge action={log.action} />
              </p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Source</span>
              <p className='mt-1'>
                <SourceBadge source={log.source} />
              </p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>User Email</span>
              <p className='mt-1 break-all font-mono text-xs'>{userEmail || '—'}</p>
            </div>
            <div>
              <span className='font-medium text-slate-500'>Request ID</span>
              <p className='mt-1 break-all font-mono text-xs'>{log.request_id || '—'}</p>
            </div>
          </div>

          {log.changed_fields && log.changed_fields.length > 0 && (
            <div>
              <span className='font-medium text-slate-500'>Changed Fields</span>
              <div className='mt-1 flex flex-wrap gap-1'>
                {log.changed_fields.map((field) => (
                  <span
                    key={field}
                    className='rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700'
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {log.old_values && Object.keys(log.old_values).length > 0 && (
            <div>
              <span className='font-medium text-slate-500'>Old Values</span>
              <pre className='mt-1 max-h-40 overflow-auto rounded bg-red-50 p-3 text-xs text-red-900'>
                {formatJson(log.old_values)}
              </pre>
            </div>
          )}

          {log.new_values && Object.keys(log.new_values).length > 0 && (
            <div>
              <span className='font-medium text-slate-500'>New Values</span>
              <pre className='mt-1 max-h-40 overflow-auto rounded bg-green-50 p-3 text-xs text-green-900'>
                {formatJson(log.new_values)}
              </pre>
            </div>
          )}

          {(log.ip_address || log.user_agent) && (
            <div className='border-t border-slate-200 pt-4'>
              <span className='font-medium text-slate-500'>Client Info</span>
              <div className='mt-1 text-sm'>
                {log.ip_address && <p>IP: {log.ip_address}</p>}
                {log.user_agent && (
                  <p className='truncate text-xs text-slate-500'>{log.user_agent}</p>
                )}
              </div>
            </div>
          )}
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
