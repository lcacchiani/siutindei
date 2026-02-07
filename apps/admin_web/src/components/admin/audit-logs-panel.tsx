'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

import {
  ApiError,
  listAuditLogs,
  listCognitoUsers,
  type AuditLogsFilters,
} from '../../lib/api-client';
import type { AuditLog } from '../../types/admin';
import { ViewIcon } from '../icons/action-icons';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
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
  userEmailById: Record<string, string>;
}

function formatJson(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '—';
  return JSON.stringify(obj, null, 2);
}

function DetailModal({ log, onClose, userEmailById }: DetailModalProps) {
  const userEmail = log.user_id ? userEmailById[log.user_id] : null;

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
              <span className='font-medium text-slate-500'>User Email</span>
              <p className='mt-1 break-all font-mono text-xs'>
                {userEmail || '—'}
              </p>
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

function formatGmtOffset(date: Date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const minuteSuffix = minutes
    ? `:${minutes.toString().padStart(2, '0')}`
    : '';
  return `GMT${sign}${hours}${minuteSuffix}`;
}

export function AuditLogsPanel() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [userLookupError, setUserLookupError] = useState('');
  const [userEmailById, setUserEmailById] = useState<
    Record<string, string>
  >({});
  const userLookupPromise = useRef<
    Promise<{
      emailById: Record<string, string>;
      idByEmail: Record<string, string>;
    }> | null
  >(null);
  const userLookupRef = useRef<{
    emailById: Record<string, string>;
    idByEmail: Record<string, string>;
  }>({ emailById: {}, idByEmail: {} });
  const isMountedRef = useRef(true);

  // Filter state
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [userEmailFilter, setUserEmailFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  const loadCognitoUsers = useCallback(
    async (showError = false) => {
      if (Object.keys(userLookupRef.current.emailById).length > 0) {
        return userLookupRef.current;
      }
      if (userLookupPromise.current) {
        return userLookupPromise.current;
      }

      userLookupPromise.current = (async () => {
        try {
          const emailById: Record<string, string> = {};
          const idByEmail: Record<string, string> = {};
          let paginationToken: string | undefined;

          do {
            const response = await listCognitoUsers(paginationToken, 60);
            for (const user of response.items) {
              if (!user.email) continue;
              const normalizedEmail = user.email.trim().toLowerCase();
              emailById[user.sub] = user.email;
              if (!idByEmail[normalizedEmail]) {
                idByEmail[normalizedEmail] = user.sub;
              }
            }
            paginationToken = response.pagination_token ?? undefined;
          } while (paginationToken);

          userLookupRef.current = { emailById, idByEmail };
          if (isMountedRef.current) {
            setUserEmailById(emailById);
          }
          return userLookupRef.current;
        } catch (err) {
          if (showError && isMountedRef.current) {
            setUserLookupError(
              err instanceof ApiError
                ? err.message
                : 'Failed to load user directory.'
            );
          }
          return { emailById: {}, idByEmail: {} };
        } finally {
          userLookupPromise.current = null;
        }
      })();

      return userLookupPromise.current;
    },
    []
  );

  const buildFilters = useCallback(async (): Promise<AuditLogsFilters> => {
    const filters: AuditLogsFilters = {};
    if (actionFilter !== 'all') {
      filters.action = actionFilter;
    }
    if (tableFilter !== 'all') {
      filters.table = tableFilter;
    }
    if (userEmailFilter.trim()) {
      const email = userEmailFilter.trim().toLowerCase();
      const userMaps = await loadCognitoUsers(true);
      const userId = userMaps.idByEmail[email];
      if (userId) {
        filters.user_id = userId;
      } else {
        filters.user_id = '__no_match__';
      }
    }
    if (recordIdFilter.trim()) {
      filters.record_id = recordIdFilter.trim();
    }
    const since = getTimestamp(timeRange);
    if (since) {
      filters.since = since;
    }
    return filters;
  }, [
    actionFilter,
    tableFilter,
    userEmailFilter,
    recordIdFilter,
    timeRange,
    loadCognitoUsers,
  ]);

  const loadItems = useCallback(
    async (cursor?: string, reset = false) => {
      setIsLoading(true);
      setError('');
      setUserLookupError('');
      try {
        const filters = await buildFilters();
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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadCognitoUsers(false);
  }, [loadCognitoUsers]);

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
    setUserEmailFilter('');
    setRecordIdFilter('');
    setTimeRange('24h');
  };

  const timestampHeader = `Timestamp ${formatGmtOffset()}`;
  const getUserEmail = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return '—';
      return userEmailById[userId] || '—';
    },
    [userEmailById]
  );

  const columns = [
    {
      key: 'timestamp',
      header: timestampHeader,
      secondary: true,
      render: (item: AuditLog) => (
        <span className='text-slate-600'>{formatDate(item.timestamp)}</span>
      ),
    },
    {
      key: 'table',
      header: 'Table',
      primary: true,
      render: (item: AuditLog) => (
        <span className='font-medium'>{item.table_name}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (item: AuditLog) => <ActionBadge action={item.action} />,
    },
    {
      key: 'user-id',
      header: 'User Email',
      render: (item: AuditLog) => (
        <span className='font-mono text-xs text-slate-600'>
          {getUserEmail(item.user_id)}
        </span>
      ),
    },
    {
      key: 'changed-fields',
      header: 'Changed Fields',
      headerClassName: 'md:hidden',
      cellClassName: 'md:hidden',
      render: (item: AuditLog) => (
        <span className='text-slate-500'>
          {item.changed_fields?.length
            ? item.changed_fields.join(', ')
            : '—'}
        </span>
      ),
    },
  ];

  function renderActions(item: AuditLog, context: 'desktop' | 'mobile') {
    return (
      <Button
        type='button'
        size='sm'
        variant='ghost'
        onClick={() => setSelectedLog(item)}
        className={context === 'mobile' ? 'flex-1' : undefined}
        aria-label='View details'
      >
        <ViewIcon className='h-4 w-4' />
      </Button>
    );
  }

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
        {userLookupError && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='User Lookup'>
              {userLookupError}
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
              <Label htmlFor='user-email-filter'>User Email</Label>
              <Input
                id='user-email-filter'
                type='text'
                placeholder='Filter by user email...'
                value={userEmailFilter}
                onChange={(e) => setUserEmailFilter(e.target.value)}
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
            <DataTable
              columns={columns}
              data={items}
              keyExtractor={(item) => item.id}
              renderActions={renderActions}
              actionsHeader='Details'
              nextCursor={nextCursor}
              onLoadMore={() => loadItems(nextCursor ?? undefined)}
              isLoading={isLoading}
              emptyMessage='No audit logs found.'
            />
            <div className='text-xs text-slate-500'>
              Showing {items.length} entries
            </div>
          </div>
        )}
      </Card>

      {selectedLog && (
        <DetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          userEmailById={userEmailById}
        />
      )}
    </div>
  );
}
