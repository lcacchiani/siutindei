'use client';

import type { ReactNode } from 'react';

import { Button } from './button';

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  /** Hide this column on mobile card view */
  hideOnMobile?: boolean;
  /** Use as primary label in mobile card view */
  primary?: boolean;
  /** Use as secondary label in mobile card view */
  secondary?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onEdit,
  onDelete,
  nextCursor,
  onLoadMore,
  isLoading,
  emptyMessage = 'No items found.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <p className='text-sm text-slate-600'>{emptyMessage}</p>;
  }

  const primaryColumn = columns.find((c) => c.primary);
  const secondaryColumn = columns.find((c) => c.secondary);
  const detailColumns = columns.filter(
    (c) => !c.primary && !c.secondary && !c.hideOnMobile
  );

  return (
    <>
      {/* Desktop table view */}
      <div className='hidden overflow-x-auto md:block'>
        <table className='w-full text-left text-sm'>
          <thead className='border-b border-slate-200 text-slate-500'>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className='py-2 pr-4 last:pr-0'>
                  {column.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className='py-2 text-right'>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={keyExtractor(item)} className='border-b border-slate-100'>
                {columns.map((column) => (
                  <td key={column.key} className='py-2 pr-4 last:pr-0'>
                    {column.render(item)}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className='py-2 text-right'>
                    <div className='flex justify-end gap-2'>
                      {onEdit && (
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          onClick={() => onEdit(item)}
                          title='Edit'
                        >
                          <EditIcon className='h-4 w-4' />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() => onDelete(item)}
                          title='Delete'
                        >
                          <DeleteIcon className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className='space-y-3 md:hidden'>
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className='rounded-lg border border-slate-200 bg-slate-50 p-3'
          >
            {/* Primary info */}
            {primaryColumn && (
              <div className='font-medium text-slate-900'>
                {primaryColumn.render(item)}
              </div>
            )}
            {/* Secondary info */}
            {secondaryColumn && (
              <div className='mt-0.5 text-sm text-slate-600'>
                {secondaryColumn.render(item)}
              </div>
            )}
            {/* Detail rows */}
            {detailColumns.length > 0 && (
              <div className='mt-2 space-y-1 border-t border-slate-200 pt-2'>
                {detailColumns.map((column) => (
                  <div
                    key={column.key}
                    className='flex items-start justify-between gap-2 text-sm'
                  >
                    <span className='text-slate-500'>{column.header}:</span>
                    <span className='text-right text-slate-700'>
                      {column.render(item)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Actions */}
            {(onEdit || onDelete) && (
              <div className='mt-3 flex gap-2 border-t border-slate-200 pt-3'>
                {onEdit && (
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    onClick={() => onEdit(item)}
                    className='flex-1'
                    title='Edit'
                  >
                    <EditIcon className='h-4 w-4' />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    onClick={() => onDelete(item)}
                    className='flex-1'
                    title='Delete'
                  >
                    <DeleteIcon className='h-4 w-4' />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more button */}
      {nextCursor && onLoadMore && (
        <div className='mt-4'>
          <Button
            type='button'
            variant='secondary'
            onClick={onLoadMore}
            disabled={isLoading}
            className='w-full sm:w-auto'
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
}
