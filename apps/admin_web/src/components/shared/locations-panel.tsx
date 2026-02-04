'use client';

import { useEffect, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import { listResource, listManagerOrganizations } from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Location, Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

interface LocationFormState {
  org_id: string;
  district: string;
  address: string;
  lat: string;
  lng: string;
}

const emptyForm: LocationFormState = {
  org_id: '',
  district: '',
  address: '',
  lat: '',
  lng: '',
};

function itemToForm(item: Location): LocationFormState {
  return {
    org_id: item.org_id ?? '',
    district: item.district ?? '',
    address: item.address ?? '',
    lat: item.lat !== undefined && item.lat !== null ? `${item.lat}` : '',
    lng: item.lng !== undefined && item.lng !== null ? `${item.lng}` : '',
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface LocationsPanelProps {
  mode: ApiMode;
}

export function LocationsPanel({ mode }: LocationsPanelProps) {
  const isAdmin = mode === 'admin';
  const panel = useResourcePanel<Location, LocationFormState>(
    'locations',
    mode,
    emptyForm,
    itemToForm
  );

  // Load organizations for the dropdown
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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
        }
      } catch {
        setOrganizations([]);
      }
    };
    loadOrganizations();
  }, [isAdmin]);

  const validate = () => {
    if (!panel.formState.org_id || !panel.formState.district.trim()) {
      return 'Organization and district are required.';
    }
    return null;
  };

  const formToPayload = (form: LocationFormState) => ({
    org_id: form.org_id,
    district: form.district.trim(),
    address: form.address.trim() || null,
    lat: parseOptionalNumber(form.lat),
    lng: parseOptionalNumber(form.lng),
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orgName = organizations.find((org) => org.id === item.org_id)?.name?.toLowerCase() || '';
    return (
      item.district?.toLowerCase().includes(query) ||
      item.address?.toLowerCase().includes(query) ||
      orgName.includes(query)
    );
  });

  return (
    <div className='space-y-6'>
      <Card title='Locations' description='Manage location entries.'>
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='location-org'>Organization</Label>
            <Select
              id='location-org'
              value={panel.formState.org_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  org_id: e.target.value,
                }))
              }
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
            <Label htmlFor='location-district'>District</Label>
            <Input
              id='location-district'
              value={panel.formState.district}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  district: e.target.value,
                }))
              }
            />
          </div>
          <div className='md:col-span-2'>
            <Label htmlFor='location-address'>Address</Label>
            <Input
              id='location-address'
              value={panel.formState.address}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='location-lat'>Latitude</Label>
            <Input
              id='location-lat'
              type='number'
              step='0.000001'
              value={panel.formState.lat}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  lat: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='location-lng'>Longitude</Label>
            <Input
              id='location-lng'
              type='number'
              step='0.000001'
              value={panel.formState.lng}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  lng: e.target.value,
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
            {panel.editingId ? 'Update Location' : 'Add Location'}
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
        title='Existing Locations'
        description='Select a location to edit or delete.'
      >
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading locations...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>No locations yet.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search locations...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>No locations match your search.</p>
            ) : (
            <>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto md:block'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>District</th>
                  <th className='py-2'>Organization</th>
                  <th className='py-2'>Address</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className='border-b border-slate-100'>
                    <td className='py-2 font-medium'>{item.district}</td>
                    <td className='py-2 text-slate-600'>
                      {organizations.find((org) => org.id === item.org_id)
                        ?.name || item.org_id}
                    </td>
                    <td className='py-2 text-slate-600'>
                      {item.address || '—'}
                    </td>
                    <td className='py-2 text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          onClick={() => panel.startEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() =>
                            panel.handleDelete({
                              ...item,
                              name: item.district,
                            })
                          }
                        >
                          Delete
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
                  <div className='font-medium text-slate-900'>{item.district}</div>
                  <div className='mt-1 text-sm text-slate-600'>
                    {organizations.find((org) => org.id === item.org_id)?.name || item.org_id}
                  </div>
                  {item.address && (
                    <div className='mt-1 text-sm text-slate-500'>{item.address}</div>
                  )}
                  <div className='mt-3 flex gap-2 border-t border-slate-200 pt-3'>
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      onClick={() => panel.startEdit(item)}
                      className='flex-1'
                    >
                      Edit
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      onClick={() =>
                        panel.handleDelete({
                          ...item,
                          name: item.district,
                        })
                      }
                      className='flex-1'
                    >
                      Delete
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
