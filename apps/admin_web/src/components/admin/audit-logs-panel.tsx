'use client';

import { useEffect, useState, useCallback } from 'react';

import {
  ApiError,
  listAuditLogs,
  type AuditLogsFilters,
} from '../../lib/api-client';
import type { AuditLog } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

type ActionFilter = 'all' | 'INSERT' | 'UPDATE' | 'DELETE';
type TableFilter = 'all' | string;

const AUDITABLE_TABLES = [
  'organizations',
  'locations',
  'activities',
  'activity_locations',
  'activity_pricing',
  'activity_schedule',
  'organization_access_requests',
  'organization_suggestions',
];

const TIME_RANGES = [
  { value: '', label: 'All time' },
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

function getTimestamp(range: string): string | undefined {
  if (!range) return undefined;
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

function ActionBadge({ action }: { action: AuditLog['action'] }) {
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

function SourceBadge({ source }: { source: AuditLog['source'] }) {
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
}

function formatJson(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '—';
  return JSON.stringify(obj, null, 2);
}

function DetailModal({ log, onClose }: DetailModalProps) {
  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'>
      <div className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-xl sm:p-6'>
        <div className='mb-4 flex items-start justify-between'>
          <h3 className='text-base font-semibold sm:text-lg'>Audit Log Detail</h3>
          <button
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
              <p className='mt-1'>{formatDate(log.timestamp)}</p>
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
              <span className='font-medium text-slate-500'>User ID</span>
              <p className='mt-1 break-all font-mono text-xs'>{log.user_id || '—'}</p>
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

function ViewIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditLogsPanel() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  const buildFilters = useCallback((): AuditLogsFilters => {
    const filters: AuditLogsFilters = {};
    if (actionFilter !== 'all') {
      filters.action = actionFilter;
    }
    if (tableFilter !== 'all') {
      filters.table = tableFilter;
    }
    if (userIdFilter.trim()) {
      filters.user_id = userIdFilter.trim();
    }
    if (recordIdFilter.trim()) {
      filters.record_id = recordIdFilter.trim();
    }
    const since = getTimestamp(timeRange);
    if (since) {
      filters.since = since;
    }
    return filters;
  }, [actionFilter, tableFilter, userIdFilter, recordIdFilter, timeRange]);

  const loadItems = useCallback(
    async (cursor?: string, reset = false) => {
      setIsLoading(true);
      setError('');
      try {
        const filters = buildFilters();
        const response = await listAuditLogs(filters, cursor, 50);
        setItems((prev) =>
          reset || !cursor ? response.items : [...prev, ...response.items]
        );
        setNextCursor(response.next_cursor ?? null);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to load audit logs.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [buildFilters]
  );

  // Load on mount and when filters change
  useEffect(() => {
    loadItems(undefined, true);
  }, [loadItems]);

  const handleApplyFilters = () => {
    loadItems(undefined, true);
  };

  const handleClearFilters = () => {
    setActionFilter('all');
    setTableFilter('all');
    setUserIdFilter('');
    setRecordIdFilter('');
    setTimeRange('24h');
  };

  return (
    <div className='space-y-6'>
      <Card
        title='Audit Logs'
        description='View database change history and track user activity.'
      >
        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}

        {/* Filters */}
        <div className='mb-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <Label htmlFor='action-filter'>Action</Label>
              <Select
                id='action-filter'
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
              >
                <option value='all'>All Actions</option>
                <option value='INSERT'>Insert</option>
                <option value='UPDATE'>Update</option>
                <option value='DELETE'>Delete</option>
              </Select>
            </div>

            <div>
              <Label htmlFor='table-filter'>Table</Label>
              <Select
                id='table-filter'
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <option value='all'>All Tables</option>
                {AUDITABLE_TABLES.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor='time-range'>Time Range</Label>
              <Select
                id='time-range'
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor='user-filter'>User ID</Label>
              <Input
                id='user-filter'
                type='text'
                placeholder='Filter by user...'
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='lg:col-span-2'>
              <Label htmlFor='record-filter'>Record ID</Label>
              <Input
                id='record-filter'
                type='text'
                placeholder='Filter by record ID...'
                value={recordIdFilter}
                onChange={(e) => setRecordIdFilter(e.target.value)}
              />
            </div>

            <div className='flex items-end gap-2 lg:col-span-2'>
              <Button
                type='button'
                variant='primary'
                onClick={handleApplyFilters}
                className='flex-1 sm:flex-initial'
              >
                Apply Filters
              </Button>
              <Button
                type='button'
                variant='secondary'
                onClick={handleClearFilters}
                className='flex-1 sm:flex-initial'
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading && items.length === 0 ? (
          <p className='text-sm text-slate-600'>Loading audit logs...</p>
        ) : items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            No audit logs found matching your filters.
          </p>
        ) : (
          <div className='space-y-4'>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto md:block'>
              <table className='w-full text-left text-sm'>
                <thead className='border-b border-slate-200 text-slate-500'>
                  <tr>
                    <th className='py-2'>Timestamp</th>
                    <th className='py-2'>Table</th>
                    <th className='py-2'>Action</th>
                    <th className='py-2'>User ID</th>
                    <th className='py-2'>Source</th>
                    <th className='py-2 text-right'>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className='border-b border-slate-100'>
                      <td className='py-2 text-slate-600'>
                        {formatDate(item.timestamp)}
                      </td>
                      <td className='py-2 font-medium'>{item.table_name}</td>
                      <td className='py-2'>
                        <ActionBadge action={item.action} />
                      </td>
                      <td className='max-w-[120px] truncate py-2 font-mono text-xs text-slate-600'>
                        {item.user_id || '—'}
                      </td>
                      <td className='py-2'>
                        <SourceBadge source={item.source} />
                      </td>
                      <td className='py-2 text-right'>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          onClick={() => setSelectedLog(item)}
                          aria-label='View details'
                        >
                          <ViewIcon className='h-4 w-4' />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className='space-y-3 md:hidden'>
              {items.map((item) => (
                <div
                  key={item.id}
                  className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <div className='font-medium text-slate-900'>
                        {item.table_name}
                      </div>
                      <div className='mt-0.5 text-xs text-slate-500'>
                        {formatDate(item.timestamp)}
                      </div>
                    </div>
                    <ActionBadge action={item.action} />
                  </div>
                  <div className='mt-2 space-y-1 text-sm'>
                    {item.user_id && (
                      <div className='truncate font-mono text-xs text-slate-500'>
                        User: {item.user_id}
                      </div>
                    )}
                    {item.changed_fields && item.changed_fields.length > 0 && (
                      <div className='text-xs text-slate-500'>
                        Changed: {item.changed_fields.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className='mt-3 flex items-center justify-between border-t border-slate-200 pt-3'>
                    <SourceBadge source={item.source} />
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => setSelectedLog(item)}
                      aria-label='View details'
                    >
                      <ViewIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => loadItems(nextCursor)}
                  disabled={isLoading}
                  className='w-full sm:w-auto'
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}

            <div className='text-xs text-slate-500'>
              Showing {items.length} entries
            </div>
          </div>
        )}
      </Card>

      {selectedLog && (
        <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
