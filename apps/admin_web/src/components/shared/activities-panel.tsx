'use client';

import { useEffect, useMemo, useState } from 'react';

import { useActivityCategories } from '../../hooks/use-activity-categories';
import { useOrganizationsByMode } from '../../hooks/use-organizations-by-mode';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import { parseRequiredNumber } from '../../lib/number-parsers';
import type { ApiMode } from '../../lib/resource-api';
import type { Activity } from '../../types/admin';
import { CascadingCategorySelect } from '../ui/cascading-category-select';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface ActivityFormState {
  org_id: string;
  category_id: string;
  name: string;
  description: string;
  age_min: string;
  age_max: string;
}

const emptyForm: ActivityFormState = {
  org_id: '',
  category_id: '',
  name: '',
  description: '',
  age_min: '',
  age_max: '',
};

function itemToForm(item: Activity): ActivityFormState {
  return {
    org_id: item.org_id ?? '',
    category_id: item.category_id ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    age_min: item.age_min !== undefined ? `${item.age_min}` : '',
    age_max: item.age_max !== undefined ? `${item.age_max}` : '',
  };
}

interface ActivitiesPanelProps {
  mode: ApiMode;
}

export function ActivitiesPanel({ mode }: ActivitiesPanelProps) {
  const isAdmin = mode === 'admin';
  const panel = useResourcePanel<Activity, ActivityFormState>(
    'activities',
    mode,
    emptyForm,
    itemToForm
  );

  const { tree: categoryTree } = useActivityCategories();

  const { items: organizations } = useOrganizationsByMode(mode, { limit: 200 });

  const categoryPathById = useMemo(() => {
    const map = new Map<string, string>();
    function walk(nodes: typeof categoryTree, prefix = '') {
      for (const node of nodes) {
        const path = prefix ? `${prefix} / ${node.name}` : node.name;
        map.set(node.id, path);
        if (node.children) {
          walk(node.children, path);
        }
      }
    }
    walk(categoryTree);
    return map;
  }, [categoryTree]);

  const getCategoryPath = (categoryId?: string) =>
    (categoryId ? categoryPathById.get(categoryId) : undefined) ?? '—';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // For managers with a single org, auto-select and disable the dropdown
  const isSingleOrgManager = !isAdmin && organizations.length === 1;

  const { setFormState } = panel;

  function getOrganizationName(orgId: string | undefined) {
    if (!orgId) {
      return '';
    }
    const match = organizations.find((org) => org.id === orgId);
    return match?.name ?? orgId;
  }

  useEffect(() => {
    if (isAdmin || organizations.length !== 1) {
      return;
    }
    const orgId = organizations[0].id;
    setFormState((prev) =>
      prev.org_id === orgId ? prev : { ...prev, org_id: orgId }
    );
  }, [isAdmin, organizations, setFormState]);

  const validate = () => {
    const ageMin = parseRequiredNumber(panel.formState.age_min);
    const ageMax = parseRequiredNumber(panel.formState.age_max);

    if (!panel.formState.org_id || !panel.formState.name.trim()) {
      return 'Organization and name are required.';
    }
    if (!panel.formState.category_id) {
      return 'Category is required.';
    }
    if (ageMin === null || ageMax === null) {
      return 'Age range must be numeric.';
    }
    if (ageMin >= ageMax) {
      return 'Age min must be less than age max.';
    }
    return null;
  };

  const formToPayload = (form: ActivityFormState) => ({
    org_id: form.org_id,
    category_id: form.category_id,
    name: form.name.trim(),
    description: form.description.trim() || null,
    age_min: parseRequiredNumber(form.age_min),
    age_max: parseRequiredNumber(form.age_max),
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: isAdmin ? 'Organization / Activity' : 'Name',
        primary: true,
        render: (item: Activity) =>
          isAdmin
            ? `${getOrganizationName(item.org_id)} - ${item.name}`
            : item.name,
      },
      {
        key: 'category',
        header: 'Category',
        secondary: true,
        render: (item: Activity) => getCategoryPath(item.category_id),
      },
      {
        key: 'age-range',
        header: 'Age Range',
        render: (item: Activity) => `${item.age_min} - ${item.age_max}`,
      },
    ],
    [getCategoryPath, getOrganizationName, isAdmin]
  );

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orgName =
      organizations
        .find((org) => org.id === item.org_id)
        ?.name?.toLowerCase() || '';
    const categoryPath = getCategoryPath(item.category_id).toLowerCase();
    return (
      item.name?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      orgName.includes(query) ||
      categoryPath.includes(query)
    );
  });

  return (
    <div className='space-y-6'>
      <Card title='Activities' description='Manage activity entries.'>
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='activity-org'>Organization</Label>
            <Select
              id='activity-org'
              value={panel.formState.org_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  org_id: e.target.value,
                }))
              }
              disabled={isSingleOrgManager}
            >
              <option value=''>Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='activity-name'>Name</Label>
            <Input
              id='activity-name'
              value={panel.formState.name}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
          </div>
          <div className='md:col-span-2'>
            <CascadingCategorySelect
              tree={categoryTree}
              value={panel.formState.category_id}
              onChange={(categoryId, _chain) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  category_id: categoryId,
                }))
              }
            />
          </div>
          <div className='md:col-span-2'>
            <Label htmlFor='activity-description'>Description</Label>
            <Textarea
              id='activity-description'
              rows={3}
              value={panel.formState.description}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='activity-age-min'>Age Min</Label>
            <Input
              id='activity-age-min'
              type='number'
              min='0'
              value={panel.formState.age_min}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  age_min: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='activity-age-max'>Age Max</Label>
            <Input
              id='activity-age-max'
              type='number'
              min='0'
              value={panel.formState.age_max}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  age_max: e.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={panel.isSaving}
          >
            {panel.editingId ? 'Update Activity' : 'Add Activity'}
          </Button>
          {panel.editingId && (
            <Button
              type='button'
              variant='secondary'
              onClick={panel.resetForm}
              disabled={panel.isSaving}
            >
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <Card
        title='Existing Activities'
        description='Select an activity to edit or delete.'
      >
        {panel.isLoading && panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>Loading activities...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>No activities yet.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search activities...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredItems}
              keyExtractor={(item) => item.id}
              onEdit={(item) => panel.startEdit(item)}
              onDelete={(item) => panel.handleDelete(item)}
              nextCursor={panel.nextCursor}
              onLoadMore={panel.loadMore}
              isLoading={panel.isLoading}
              emptyMessage={
                searchQuery.trim()
                  ? 'No activities match your search.'
                  : 'No activities yet.'
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
