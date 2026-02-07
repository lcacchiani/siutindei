'use client';

import { useMemo, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import type { ActivityCategory } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

function EditIcon({ className }: { className?: string }) {
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
      <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
      <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
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
      <polyline points='3 6 5 6 21 6' />
      <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
      <line x1='10' y1='11' x2='10' y2='17' />
      <line x1='14' y1='11' x2='14' y2='17' />
    </svg>
  );
}

interface ActivityCategoryFormState {
  name: string;
  parent_id: string;
  display_order: string;
}

const emptyForm: ActivityCategoryFormState = {
  name: '',
  parent_id: '',
  display_order: '0',
};

function itemToForm(item: ActivityCategory): ActivityCategoryFormState {
  return {
    name: item.name ?? '',
    parent_id: item.parent_id ?? '',
    display_order:
      item.display_order !== undefined ? `${item.display_order}` : '0',
  };
}

function parseDisplayOrder(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

export function ActivityCategoriesPanel() {
  const panel = useResourcePanel<ActivityCategory, ActivityCategoryFormState>(
    'activity-categories',
    'admin',
    emptyForm,
    itemToForm
  );

  const [searchQuery, setSearchQuery] = useState('');

  const childrenByParent = useMemo(() => {
    const map = new Map<string, ActivityCategory[]>();
    for (const category of panel.items) {
      const parentId = category.parent_id ?? '';
      const list = map.get(parentId) ?? [];
      list.push(category);
      map.set(parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const order = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (order !== 0) return order;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [panel.items]);

  const categoryPathById = useMemo(() => {
    const map = new Map<string, string>();
    function walk(nodes: ActivityCategory[], prefix = '') {
      for (const node of nodes) {
        const path = prefix ? `${prefix} / ${node.name}` : node.name;
        map.set(node.id, path);
        const children = childrenByParent.get(node.id) ?? [];
        walk(children, path);
      }
    }
    const roots = childrenByParent.get('') ?? [];
    walk(roots);
    return map;
  }, [childrenByParent]);

  const excludedIds = useMemo(() => {
    if (!panel.editingId) return new Set<string>();
    const excluded = new Set<string>([panel.editingId]);
    const stack = [panel.editingId];
    while (stack.length > 0) {
      const current = stack.pop() ?? '';
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        if (excluded.has(child.id)) continue;
        excluded.add(child.id);
        stack.push(child.id);
      }
    }
    return excluded;
  }, [panel.editingId, childrenByParent]);

  const parentOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [];
    function walk(nodes: ActivityCategory[], prefix = '') {
      for (const node of nodes) {
        const path = prefix ? `${prefix} / ${node.name}` : node.name;
        if (!excludedIds.has(node.id)) {
          options.push({ id: node.id, label: path });
        }
        const children = childrenByParent.get(node.id) ?? [];
        walk(children, path);
      }
    }
    const roots = childrenByParent.get('') ?? [];
    walk(roots);
    return options;
  }, [childrenByParent, excludedIds]);

  const validate = () => {
    if (!panel.formState.name.trim()) {
      return 'Name is required.';
    }
    const order = parseDisplayOrder(panel.formState.display_order);
    if (order === null || order < 0) {
      return 'Display order must be a valid number.';
    }
    return null;
  };

  const formToPayload = (form: ActivityCategoryFormState) => ({
    name: form.name.trim(),
    parent_id: form.parent_id || null,
    display_order: parseDisplayOrder(form.display_order),
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const path = categoryPathById.get(item.id)?.toLowerCase() ?? '';
    return path.includes(query) || item.name.toLowerCase().includes(query);
  });

  return (
    <div className='space-y-6'>
      <Card
        title='Activity Categories'
        description='Manage categories and subcategories.'
      >
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='category-name'>Name</Label>
            <Input
              id='category-name'
              value={panel.formState.name}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='category-parent'>Parent</Label>
            <Select
              id='category-parent'
              value={panel.formState.parent_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  parent_id: e.target.value,
                }))
              }
            >
              <option value=''>No parent (root)</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='category-order'>Display Order</Label>
            <Input
              id='category-order'
              type='number'
              min='0'
              step='1'
              value={panel.formState.display_order}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  display_order: e.target.value,
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
            {panel.editingId ? 'Update Category' : 'Add Category'}
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
        title='Existing Categories'
        description='Select a category to edit or delete.'
      >
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading categories...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>No categories yet.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search categories...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>
                No categories match your search.
              </p>
            ) : (
              <>
                <div className='hidden overflow-x-auto md:block'>
                  <table className='w-full text-left text-sm'>
                    <thead className='border-b border-slate-200 text-slate-500'>
                      <tr>
                        <th className='py-2'>Path</th>
                        <th className='py-2'>Display Order</th>
                        <th className='py-2 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className='border-b border-slate-100'
                        >
                          <td className='py-2 font-medium'>
                            {categoryPathById.get(item.id) || item.name}
                          </td>
                          <td className='py-2 text-slate-600'>
                            {item.display_order ?? 0}
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

                <div className='space-y-3 md:hidden'>
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                    >
                      <div className='font-medium text-slate-900'>
                        {categoryPathById.get(item.id) || item.name}
                      </div>
                      <div className='mt-1 text-sm text-slate-500'>
                        Display order: {item.display_order ?? 0}
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
