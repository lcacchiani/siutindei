'use client';

import type { ReactNode } from 'react';

import { Button } from './button';

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
                        >
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() => onDelete(item)}
                        >
                          Delete
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
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    onClick={() => onDelete(item)}
                    className='flex-1'
                  >
                    Delete
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
