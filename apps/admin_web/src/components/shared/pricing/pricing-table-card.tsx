'use client';

import type { DataTableColumn } from '../../ui/data-table';
import type { ActivityPricing } from '../../../types/admin';
import { Card } from '../../ui/card';
import { DataTable } from '../../ui/data-table';
import { SearchInput } from '../../ui/search-input';

interface PricingTableCardProps {
  isLoading: boolean;
  hasItems: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  columns: DataTableColumn<ActivityPricing>[];
  data: ActivityPricing[];
  onEdit: (item: ActivityPricing) => void;
  onDelete: (item: ActivityPricing) => void;
  nextCursor: string | null;
  onLoadMore: () => void;
}

export function PricingTableCard({
  isLoading,
  hasItems,
  searchQuery,
  onSearchChange,
  columns,
  data,
  onEdit,
  onDelete,
  nextCursor,
  onLoadMore,
}: PricingTableCardProps) {
  return (
    <Card
      title='Existing Pricing'
      description='Select a pricing entry to edit or delete.'
    >
      {isLoading ? (
        <p className='text-sm text-slate-600'>Loading pricing...</p>
      ) : !hasItems ? (
        <p className='text-sm text-slate-600'>No pricing entries yet.</p>
      ) : (
        <div className='space-y-4'>
          <div className='max-w-full sm:max-w-sm'>
            <SearchInput
              placeholder='Search pricing...'
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <DataTable
            columns={columns}
            data={data}
            keyExtractor={(item) => item.id}
            onEdit={onEdit}
            onDelete={onDelete}
            nextCursor={nextCursor}
            onLoadMore={onLoadMore}
            isLoading={isLoading}
            emptyMessage={
              searchQuery.trim()
                ? 'No pricing entries match your search.'
                : 'No pricing entries yet.'
            }
          />
        </div>
      )}
    </Card>
  );
}
