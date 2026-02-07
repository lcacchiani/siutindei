'use client';

import { useEffect, useState } from 'react';

import { useGeographicAreas } from '../../hooks/use-geographic-areas';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import { listResource, listManagerOrganizations } from '../../lib/api-client';
import type { GeographicAreaNode } from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Location, Organization } from '../../types/admin';
import {
  AddressAutocomplete,
  type AddressSelection,
} from '../ui/address-autocomplete';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { CascadingAreaSelect } from '../ui/cascading-area-select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
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

interface LocationFormState {
  org_id: string;
  area_id: string;
  address: string;
  lat: string;
  lng: string;
}

const emptyForm: LocationFormState = {
  org_id: '',
  area_id: '',
  address: '',
  lat: '',
  lng: '',
};

function itemToForm(item: Location): LocationFormState {
  return {
    org_id: item.org_id ?? '',
    area_id: item.area_id ?? '',
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

  // Geographic area tree for cascading dropdowns
  const { tree, countryCodes, matchNominatimResult } = useGeographicAreas();

  // Load organizations for the dropdown
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Build a flat area name lookup for display
  const areaNameById = new Map<string, string>();
  function walkTree(nodes: GeographicAreaNode[]) {
    for (const n of nodes) {
      areaNameById.set(n.id, n.name);
      if (n.children) walkTree(n.children);
    }
  }
  walkTree(tree);
  const getAreaName = (areaId?: string) => (areaId ? areaNameById.get(areaId) : undefined) ?? '—';

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

  const handleAddressSelect = (selection: AddressSelection) => {
    // Try to reverse-match the Nominatim result to the area tree
    const match = matchNominatimResult(selection.raw);
    panel.setFormState((prev) => ({
      ...prev,
      address: selection.displayName,
      lat: `${selection.lat}`,
      lng: `${selection.lng}`,
      // Auto-fill area_id if we found a match in the tree
      area_id: match ? match.areaId : prev.area_id,
    }));
  };

  const handleAreaChange = (areaId: string, _chain: GeographicAreaNode[]) => {
    panel.setFormState((prev) => ({ ...prev, area_id: areaId }));
  };

  const validate = () => {
    if (!panel.formState.org_id || !panel.formState.area_id) {
      return 'Organization and area are required.';
    }
    return null;
  };

  const formToPayload = (form: LocationFormState) => ({
    org_id: form.org_id,
    area_id: form.area_id,
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
    const areaName = getAreaName(item.area_id).toLowerCase();
    return (
      areaName.includes(query) ||
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
            <Label htmlFor='location-address'>Address</Label>
            <AddressAutocomplete
              id='location-address'
              value={panel.formState.address}
              onChange={(val) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  address: val,
                }))
              }
              onSelect={handleAddressSelect}
              placeholder='Start typing an address...'
              countryCodes={countryCodes}
            />
          </div>
          <div className='md:col-span-2'>
            <CascadingAreaSelect
              tree={tree}
              value={panel.formState.area_id}
              onChange={handleAreaChange}
              disableCountry
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
                  <th className='py-2'>Area</th>
                  {isAdmin && <th className='py-2'>Organization</th>}
                  <th className='py-2'>Address</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className='border-b border-slate-100'>
                    <td className='py-2 font-medium'>{getAreaName(item.area_id)}</td>
                    {isAdmin && (
                      <td className='py-2 text-slate-600'>
                        {organizations.find((org) => org.id === item.org_id)
                          ?.name || item.org_id}
                      </td>
                    )}
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
                          title='Edit'
                        >
                          <EditIcon className='h-4 w-4' />
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          onClick={() =>
                            panel.handleDelete({
                              ...item,
                              name: getAreaName(item.area_id),
                            })
                          }
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
                  <div className='font-medium text-slate-900'>{getAreaName(item.area_id)}</div>
                  {isAdmin && (
                    <div className='mt-1 text-sm text-slate-600'>
                      {organizations.find((org) => org.id === item.org_id)?.name || item.org_id}
                    </div>
                  )}
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
                      title='Edit'
                    >
                      <EditIcon className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      onClick={() =>
                        panel.handleDelete({
                          ...item,
                          name: getAreaName(item.area_id),
                        })
                      }
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
