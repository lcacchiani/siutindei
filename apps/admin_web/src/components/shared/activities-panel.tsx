'use client';

import { useEffect, useMemo, useState } from 'react';

import { useActivityCategories } from '../../hooks/use-activity-categories';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import { listResource, listManagerOrganizations } from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Activity, Organization } from '../../types/admin';
import { CascadingCategorySelect } from '../ui/cascading-category-select';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

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

function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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

  // Load organizations for the dropdown
  const [organizations, setOrganizations] = useState<Organization[]>([]);

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

  // Extract setFormState for stable reference in useEffect
  const { setFormState } = panel;

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        if (isAdmin) {
          const response = await listResource<Organization>(
            'organizations',
            undefined,
            200
          );
          setOrganizations(response.items);
        } else {
          const response = await listManagerOrganizations();
          setOrganizations(response.items);
          // Auto-select if manager has exactly one organization
          if (response.items.length === 1) {
            setFormState((prev) => ({
              ...prev,
              org_id: response.items[0].id,
            }));
          }
        }
      } catch {
        setOrganizations([]);
      }
    };
    loadOrganizations();
  }, [isAdmin, setFormState]);

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

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orgName = organizations.find((org) => org.id === item.org_id)?.name?.toLowerCase() || '';
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
          <div className='md:col-span-2'>
            <Label htmlFor='activity-category'>Category</Label>
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
        {panel.isLoading ? (
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
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>No activities match your search.</p>
            ) : (
            <>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto md:block'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Name</th>
                  <th className='py-2'>Category</th>
                  {isAdmin && <th className='py-2'>Organization</th>}
                  <th className='py-2'>Age Range</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className='border-b border-slate-100'>
                    <td className='py-2 font-medium'>{item.name}</td>
                    <td className='py-2 text-slate-600'>
                      {getCategoryPath(item.category_id)}
                    </td>
                    {isAdmin && (
                      <td className='py-2 text-slate-600'>
                        {organizations.find((org) => org.id === item.org_id)
                          ?.name || item.org_id}
                      </td>
                    )}
                    <td className='py-2 text-slate-600'>
                      {item.age_min} - {item.age_max}
                    </td>
                    <td className='py-2 text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          onClick={() => panel.startEdit(item)}
                          title='Edit'
                        >
                          <EditIcon className='h-4 w-4' />
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() => panel.handleDelete(item)}
                          title='Delete'
                        >
                          <DeleteIcon className='h-4 w-4' />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile card view */}
            <div className='space-y-3 md:hidden'>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                >
                  <div className='font-medium text-slate-900'>{item.name}</div>
                  <div className='mt-1 text-sm text-slate-600'>
                    {getCategoryPath(item.category_id)}
                  </div>
                  {isAdmin && (
                    <div className='mt-1 text-sm text-slate-600'>
                      {organizations.find((org) => org.id === item.org_id)?.name || item.org_id}
                    </div>
                  )}
                  <div className='mt-1 text-sm text-slate-500'>
                    Ages: {item.age_min} - {item.age_max}
                  </div>
                  <div className='mt-3 flex gap-2 border-t border-slate-200 pt-3'>
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      onClick={() => panel.startEdit(item)}
                      className='flex-1'
                      title='Edit'
                    >
                      <EditIcon className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      onClick={() => panel.handleDelete(item)}
                      className='flex-1'
                      title='Delete'
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {panel.nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={panel.loadMore}
                  className='w-full sm:w-auto'
                >
                  Load more
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
