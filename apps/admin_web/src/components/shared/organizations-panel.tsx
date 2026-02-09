'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import { ApiError, listCognitoUsers } from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import {
  buildTranslationsPayload,
  emptyTranslations,
  extractTranslations,
  type LanguageCode,
  type TranslationLanguageCode,
} from '../../lib/translations';
import type { CognitoUser, Organization } from '../../types/admin';
import { useAuth } from '../auth-provider';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { LanguageToggleInput } from '../ui/language-toggle-input';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';


interface IconProps {
  className?: string;
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M22 16.9v3a2 2 0 0 1-2.2 2' />
      <path d='M3 5a2 2 0 0 1 2-2h3' />
      <path d='M5 3h3a2 2 0 0 1 2 1.7' />
      <path d='M8.6 7.6a16 16 0 0 0 7.8 7.8' />
      <path d='M16.4 15.4 20 14a2 2 0 0 1 2 1.3' />
    </svg>
  );
}

function EmailIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <rect x='2' y='4' width='20' height='16' rx='2' />
      <path d='m22 7-10 6L2 7' />
    </svg>
  );
}

function ServiceIcon({ className, src }: IconProps & { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt=''
      aria-hidden='true'
      loading='lazy'
      width={16}
      height={16}
    />
  );
}

function ContactIcon({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span
      className='inline-flex items-center'
      title={label}
      aria-label={label}
    >
      {children}
    </span>
  );
}

function hasValue(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function looksLikeUrl(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return true;
  }
  if (lower.startsWith('www.')) {
    return true;
  }
  return value.includes('/');
}

function normalizeSocialUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidSocialHandle(value: string): boolean {
  return /^@?[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
}

function normalizeSocialValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (looksLikeUrl(trimmed)) {
    return normalizeSocialUrl(trimmed);
  }
  return trimmed;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isTranslationsEmpty(
  translations: Record<TranslationLanguageCode, string>
): boolean {
  return Object.values(translations).every((value) => !value.trim());
}

function isValidPhoneNumber(
  countryCode: string,
  number: string
): boolean {
  if (!countryCode) {
    return false;
  }
  try {
    const parsed = parsePhoneNumberFromString(
      number,
      countryCode as CountryCode
    );
    return Boolean(parsed && parsed.isValid());
  } catch {
    return false;
  }
}
interface OrganizationFormState {
  name: string;
  description: string;
  name_translations: Record<TranslationLanguageCode, string>;
  description_translations: Record<TranslationLanguageCode, string>;
  manager_id: string;
  phone_country_code: string;
  phone_number: string;
  email: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  twitter: string;
  xiaohongshu: string;
  wechat: string;
}

const emptyForm: OrganizationFormState = {
  name: '',
  description: '',
  name_translations: emptyTranslations(),
  description_translations: emptyTranslations(),
  manager_id: '',
  phone_country_code: 'HK',
  phone_number: '',
  email: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  twitter: '',
  xiaohongshu: '',
  wechat: '',
};

function itemToForm(item: Organization): OrganizationFormState {
  return {
    name: item.name ?? '',
    description: item.description ?? '',
    name_translations: extractTranslations(item.name_translations),
    description_translations: extractTranslations(item.description_translations),
    manager_id: item.manager_id ?? '',
    phone_country_code: item.phone_country_code ?? 'HK',
    phone_number: item.phone_number ?? '',
    email: item.email ?? '',
    whatsapp: item.whatsapp ?? '',
    facebook: item.facebook ?? '',
    instagram: item.instagram ?? '',
    tiktok: item.tiktok ?? '',
    twitter: item.twitter ?? '',
    xiaohongshu: item.xiaohongshu ?? '',
    wechat: item.wechat ?? '',
  };
}

type SocialFieldKey =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'xiaohongshu'
  | 'wechat';

const SOCIAL_ICON_BASE_URL =
  'https://api.iconify.design/simple-icons';

function buildSocialIconUrl(slug: string, color: string): string {
  return `${SOCIAL_ICON_BASE_URL}/${slug}.svg?color=%23${color}`;
}

const SOCIAL_FIELDS: Array<{
  key: SocialFieldKey;
  label: string;
  iconSrc: string;
}> = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    iconSrc: buildSocialIconUrl('whatsapp', '25D366'),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    iconSrc: buildSocialIconUrl('facebook', '1877F2'),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    iconSrc: buildSocialIconUrl('instagram', 'E4405F'),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    iconSrc: buildSocialIconUrl('tiktok', '000000'),
  },
  {
    key: 'twitter',
    label: 'X',
    iconSrc: buildSocialIconUrl('x', '000000'),
  },
  {
    key: 'xiaohongshu',
    label: 'Xiaohongshu',
    iconSrc: buildSocialIconUrl('xiaohongshu', 'FF2442'),
  },
  {
    key: 'wechat',
    label: 'WeChat',
    iconSrc: buildSocialIconUrl('wechat', '07C160'),
  },
];

function getManagerDisplayName(managerId: string, users: CognitoUser[]): string {
  const user = users.find((u) => u.sub === managerId);
  if (!user) {
    return managerId.slice(0, 8) + '...';
  }
  return user.email || user.username || user.sub.slice(0, 8) + '...';
}

interface OrganizationsPanelProps {
  mode: ApiMode;
}

export function OrganizationsPanel({ mode }: OrganizationsPanelProps) {
  const isAdmin = mode === 'admin';
  const isManager = mode === 'manager';
  const { user } = useAuth();
  const panel = useResourcePanel<Organization, OrganizationFormState>(
    'organizations',
    mode,
    emptyForm,
    itemToForm
  );
  const { items, editingId, startEdit } = panel;

  // Admin-only: Load Cognito users for manager selection
  const [cognitoUsers, setCognitoUsers] = useState<CognitoUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(isAdmin);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const [touchedState, setTouchedState] = useState<{
    key: string;
    fields: Record<string, boolean>;
  }>({ key: '', fields: {} });
  const [submittedState, setSubmittedState] = useState<{
    key: string;
    value: boolean;
  }>({ key: '', value: false });

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';

  const markTouched = (field: string) => {
    setTouchedState((prev) => {
      if (prev.key !== formKey) {
        return { key: formKey, fields: { [field]: true } };
      }
      if (prev.fields[field]) {
        return prev;
      }
      return { key: formKey, fields: { ...prev.fields, [field]: true } };
    });
    setSubmittedState((prev) => {
      if (prev.key !== formKey || isFormEmpty) {
        return { key: formKey, value: false };
      }
      return prev;
    });
  };
  const shouldShowError = (field: string, message: string) =>
    Boolean(
      message &&
        (hasSubmitted || activeTouchedFields[field])
    );

  // Extract setError for stable reference in useEffect
  const { setError } = panel;

  useEffect(() => {
    if (!isAdmin) return;

    const loadCognitoUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const allUsers: CognitoUser[] = [];
        let paginationToken: string | undefined;

        do {
          const response = await listCognitoUsers(paginationToken, 60);
          allUsers.push(...response.items);
          paginationToken = response.pagination_token ?? undefined;
        } while (paginationToken);

        setCognitoUsers(allUsers);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to load users for manager selection.';
        setError(message);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadCognitoUsers();
  }, [isAdmin, setError]);

  useEffect(() => {
    if (!isManager) {
      return;
    }
    if (items.length === 0) {
      return;
    }
    if (editingId) {
      return;
    }
    startEdit(items[0]);
  }, [editingId, isManager, items, startEdit]);

  const isFormEmpty =
    panel.formState.name.trim() === '' &&
    panel.formState.description.trim() === '' &&
    panel.formState.manager_id === '' &&
    panel.formState.phone_number.trim() === '' &&
    panel.formState.email.trim() === '' &&
    panel.formState.whatsapp.trim() === '' &&
    panel.formState.facebook.trim() === '' &&
    panel.formState.instagram.trim() === '' &&
    panel.formState.tiktok.trim() === '' &&
    panel.formState.twitter.trim() === '' &&
    panel.formState.xiaohongshu.trim() === '' &&
    panel.formState.wechat.trim() === '' &&
    panel.formState.phone_country_code === emptyForm.phone_country_code &&
    isTranslationsEmpty(panel.formState.name_translations) &&
    isTranslationsEmpty(panel.formState.description_translations);

  const formKey = panel.editingId ?? 'new';
  const activeTouchedFields =
    isFormEmpty || touchedState.key !== formKey ? {} : touchedState.fields;
  const hasSubmitted =
    isFormEmpty || submittedState.key !== formKey ? false : submittedState.value;

  const countryOptions = useMemo(() => {
    const display =
      typeof Intl !== 'undefined' &&
      typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : null;
    return getCountries()
      .map((country) => {
        const callingCode = getCountryCallingCode(country);
        const name = display?.of(country) ?? country;
        return {
          code: country,
          label: `${name} (+${callingCode})`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const validate = () => {
    if (!panel.formState.name.trim()) {
      return 'Name is required.';
    }
    const normalizedName = normalizeKey(panel.formState.name);
    const hasDuplicate = panel.items.some((item) => {
      if (!item.name) {
        return false;
      }
      if (panel.editingId && item.id === panel.editingId) {
        return false;
      }
      return normalizeKey(item.name) === normalizedName;
    });
    if (hasDuplicate) {
      return 'Organization name must be unique (case-insensitive).';
    }
    if (isAdmin && !panel.formState.manager_id) {
      return 'Manager is required.';
    }
    const email = panel.formState.email.trim();
    if (email && !isValidEmail(email)) {
      return 'Email is invalid.';
    }
    const phoneNumber = panel.formState.phone_number.trim();
    const phoneCountryCode = panel.formState.phone_country_code.trim();
    if (phoneNumber) {
      const normalizedNumber = normalizePhoneNumber(phoneNumber);
      if (!normalizedNumber) {
        return 'Phone number must contain digits.';
      }
      if (!phoneCountryCode) {
        return 'Phone country code is required.';
      }
      if (!isValidPhoneNumber(phoneCountryCode, normalizedNumber)) {
        return 'Phone number is invalid for selected country.';
      }
    }
    for (const field of SOCIAL_FIELDS) {
      const value = panel.formState[field.key].trim();
      if (!value) {
        continue;
      }
      if (looksLikeUrl(value)) {
        const urlValue = normalizeSocialUrl(value);
        if (!isValidUrl(urlValue)) {
          return `${field.label} URL is invalid.`;
        }
      } else if (!isValidSocialHandle(value)) {
        return `${field.label} must be a valid handle or URL.`;
      }
    }
    return null;
  };

  const nameError = useMemo(() => {
    const trimmedName = panel.formState.name.trim();
    if (!trimmedName) {
      return 'Enter an organization name.';
    }
    const normalizedName = normalizeKey(trimmedName);
    const hasDuplicate = panel.items.some((item) => {
      if (!item.name) {
        return false;
      }
      if (panel.editingId && item.id === panel.editingId) {
        return false;
      }
      return normalizeKey(item.name) === normalizedName;
    });
    if (hasDuplicate) {
      return 'Name already exists.';
    }
    return '';
  }, [panel.editingId, panel.formState.name, panel.items]);

  const managerError =
    isAdmin && !panel.formState.manager_id ? 'Select a manager.' : '';

  const emailError = useMemo(() => {
    const trimmed = panel.formState.email.trim();
    if (!trimmed) {
      return '';
    }
    return isValidEmail(trimmed) ? '' : 'Enter a valid email address.';
  }, [panel.formState.email]);

  const { phoneCountryError, phoneNumberError } = useMemo(() => {
    const phoneNumber = panel.formState.phone_number.trim();
    const phoneCountryCode = panel.formState.phone_country_code.trim();
    if (!phoneNumber) {
      return { phoneCountryError: '', phoneNumberError: '' };
    }
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    if (!normalizedNumber) {
      return {
        phoneCountryError: '',
        phoneNumberError: 'Enter digits only.',
      };
    }
    if (!phoneCountryCode) {
      return {
        phoneCountryError: 'Select a country code.',
        phoneNumberError: '',
      };
    }
    if (!isValidPhoneNumber(phoneCountryCode, normalizedNumber)) {
      return {
        phoneCountryError: '',
        phoneNumberError: 'Enter a valid phone number.',
      };
    }
    return { phoneCountryError: '', phoneNumberError: '' };
  }, [panel.formState.phone_country_code, panel.formState.phone_number]);

  const socialErrors = useMemo(() => {
    const errors: Record<SocialFieldKey, string> = {
      whatsapp: '',
      facebook: '',
      instagram: '',
      tiktok: '',
      twitter: '',
      xiaohongshu: '',
      wechat: '',
    };
    for (const field of SOCIAL_FIELDS) {
      const value = panel.formState[field.key].trim();
      if (!value) {
        continue;
      }
      if (looksLikeUrl(value)) {
        const urlValue = normalizeSocialUrl(value);
        if (!isValidUrl(urlValue)) {
          errors[field.key] = 'Enter a valid URL.';
        }
      } else if (!isValidSocialHandle(value)) {
        errors[field.key] = 'Enter a valid handle or URL.';
      }
    }
    return errors;
  }, [panel.formState]);

  const handleNameChange = (language: LanguageCode, value: string) => {
    markTouched('name');
    panel.setFormState((prev) =>
      language === 'en'
        ? { ...prev, name: value }
        : {
            ...prev,
            name_translations: {
              ...prev.name_translations,
              [language]: value,
            },
          }
    );
  };

  const handleDescriptionChange = (language: LanguageCode, value: string) => {
    panel.setFormState((prev) =>
      language === 'en'
        ? { ...prev, description: value }
        : {
            ...prev,
            description_translations: {
              ...prev.description_translations,
              [language]: value,
            },
          }
    );
  };

  const formToPayload = (form: OrganizationFormState) => {
    const existingOrg = panel.items.find((item) => item.id === panel.editingId);
    const phoneNumber = normalizePhoneNumber(form.phone_number);
    const email = form.email.trim();
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      name_translations: buildTranslationsPayload(form.name_translations),
      description_translations: buildTranslationsPayload(
        form.description_translations
      ),
      media_urls: existingOrg?.media_urls ?? [],
      phone_country_code: phoneNumber
        ? form.phone_country_code.trim().toUpperCase()
        : null,
      phone_number: phoneNumber || null,
      email: email || null,
      whatsapp: normalizeSocialValue(form.whatsapp),
      facebook: normalizeSocialValue(form.facebook),
      instagram: normalizeSocialValue(form.instagram),
      tiktok: normalizeSocialValue(form.tiktok),
      twitter: normalizeSocialValue(form.twitter),
      xiaohongshu: normalizeSocialValue(form.xiaohongshu),
      wechat: normalizeSocialValue(form.wechat),
    };
    if (isAdmin) {
      payload.manager_id = form.manager_id;
    }
    return payload;
  };

  const handleSubmit = () => {
    setSubmittedState({ key: formKey, value: true });
    return panel.handleSubmit(formToPayload, validate);
  };

  // Manager mode: Don't show create form, only edit
  const showCreateForm = isAdmin || panel.editingId;
  const canCreate = isAdmin;

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameTranslations = Object.values(item.name_translations ?? {})
      .join(' ')
      .toLowerCase();
    const descriptionTranslations = Object.values(
      item.description_translations ?? {}
    )
      .join(' ')
      .toLowerCase();
    const managerDisplay = getManagerDisplayName(item.manager_id, cognitoUsers).toLowerCase();
    return (
      item.name?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      nameTranslations.includes(query) ||
      descriptionTranslations.includes(query) ||
      managerDisplay.includes(query)
    );
  });

  const showNameError = shouldShowError('name', nameError);
  const showManagerError = shouldShowError('manager_id', managerError);
  const showEmailError = shouldShowError('email', emailError);
  const showPhoneCountryError = shouldShowError(
    'phone_country_code',
    phoneCountryError
  );
  const showPhoneNumberError = shouldShowError(
    'phone_number',
    phoneNumberError
  );

  const showSocialError = (key: SocialFieldKey) =>
    shouldShowError(key, socialErrors[key]);

  const renderContactIcons = (item: Organization) => {
    const icons: ReactElement[] = [];
    if (hasValue(item.phone_country_code) && hasValue(item.phone_number)) {
      icons.push(
        <ContactIcon key='phone' label='Phone'>
          <PhoneIcon className='h-4 w-4' />
        </ContactIcon>
      );
    }
    if (hasValue(item.email)) {
      icons.push(
        <ContactIcon key='email' label='Email'>
          <EmailIcon className='h-4 w-4' />
        </ContactIcon>
      );
    }
    for (const field of SOCIAL_FIELDS) {
      const value = item[field.key];
      if (!hasValue(value)) {
        continue;
      }
      icons.push(
        <ContactIcon key={field.key} label={field.label}>
          <ServiceIcon className='h-4 w-4' src={field.iconSrc} />
        </ContactIcon>
      );
    }
    if (icons.length === 0) {
      return <span className='text-slate-400'>—</span>;
    }
    return (
      <div className='flex flex-wrap items-center gap-2 text-slate-500'>
        {icons}
      </div>
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      render: (item: Organization) => item.name,
    },
    ...(isAdmin
      ? [
          {
            key: 'manager',
            header: 'Manager',
            secondary: true,
            render: (item: Organization) =>
              getManagerDisplayName(item.manager_id, cognitoUsers),
          },
        ]
      : []),
    {
      key: 'description',
      header: 'Description',
      render: (item: Organization) => item.description || '—',
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (item: Organization) => renderContactIcons(item),
    },
  ];

  return (
    <div className='space-y-6'>
      {showCreateForm && (
        <Card
          title={panel.editingId ? 'Edit Organization' : 'New Organization'}
          description={
            isAdmin
              ? 'Create and manage organizations. Use the Media section to add images.'
              : 'Update your organization details.'
          }
        >
          {panel.error && (
            <div className='mb-4'>
              <StatusBanner variant='error' title='Error'>
                {panel.error}
              </StatusBanner>
            </div>
          )}
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-1'>
              <LanguageToggleInput
                id='org-name'
                label='Name'
                required
                values={{
                  en: panel.formState.name,
                  zh: panel.formState.name_translations.zh,
                  yue: panel.formState.name_translations.yue,
                }}
                onChange={handleNameChange}
                hasError={showNameError}
                inputClassName={showNameError ? errorInputClassName : ''}
              />
              {showNameError ? (
                <p className='text-xs text-red-600'>{nameError}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor='org-manager'>
                Manager
                {isAdmin ? (
                  <span className='ml-1'>{requiredIndicator}</span>
                ) : null}
              </Label>
              {isAdmin ? (
                <Select
                  id='org-manager'
                  value={panel.formState.manager_id}
                  onChange={(e) => {
                    markTouched('manager_id');
                    panel.setFormState((prev) => ({
                      ...prev,
                      manager_id: e.target.value,
                    }));
                  }}
                  disabled={isLoadingUsers}
                  className={showManagerError ? errorInputClassName : ''}
                  aria-invalid={showManagerError || undefined}
                >
                  <option value=''>
                    {isLoadingUsers ? 'Loading users...' : 'Select a manager'}
                  </option>
                  {cognitoUsers.map((cognitoUser) => (
                    <option key={cognitoUser.sub} value={cognitoUser.sub}>
                      {cognitoUser.email || cognitoUser.username || cognitoUser.sub}
                      {cognitoUser.name ? ` (${cognitoUser.name})` : ''}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  id='org-manager'
                  value={user?.email ?? ''}
                  disabled
                  className={showManagerError ? errorInputClassName : ''}
                >
                  <option value={user?.email ?? ''}>
                    {user?.email ?? 'Unknown'}
                  </option>
                </Select>
              )}
              {showManagerError ? (
                <p className='text-xs text-red-600'>{managerError}</p>
              ) : null}
            </div>
            <div className='md:col-span-2'>
              <LanguageToggleInput
                id='org-description'
                label='Description'
                multiline
                rows={3}
                values={{
                  en: panel.formState.description,
                  zh: panel.formState.description_translations.zh,
                  yue: panel.formState.description_translations.yue,
                }}
                onChange={handleDescriptionChange}
              />
            </div>
            <div className='md:col-span-2 space-y-1'>
              <Label htmlFor='org-email'>Email</Label>
              <Input
                id='org-email'
                type='email'
                value={panel.formState.email}
                onChange={(e) => {
                  markTouched('email');
                  panel.setFormState((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }));
                }}
                placeholder='contact@example.com'
                className={showEmailError ? errorInputClassName : ''}
                aria-invalid={showEmailError || undefined}
              />
              {showEmailError ? (
                <p className='text-xs text-red-600'>{emailError}</p>
              ) : null}
            </div>
            <div className='space-y-1'>
              <Label htmlFor='org-phone-country'>Phone country</Label>
              <Select
                id='org-phone-country'
                value={panel.formState.phone_country_code}
                onChange={(e) => {
                  markTouched('phone_country_code');
                  panel.setFormState((prev) => ({
                    ...prev,
                    phone_country_code: e.target.value,
                  }));
                }}
                className={showPhoneCountryError ? errorInputClassName : ''}
                aria-invalid={showPhoneCountryError || undefined}
              >
                {countryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {showPhoneCountryError ? (
                <p className='text-xs text-red-600'>{phoneCountryError}</p>
              ) : null}
            </div>
            <div className='space-y-1'>
              <Label htmlFor='org-phone-number'>Phone number</Label>
              <Input
                id='org-phone-number'
                type='tel'
                inputMode='numeric'
                value={panel.formState.phone_number}
                onChange={(e) => {
                  markTouched('phone_number');
                  panel.setFormState((prev) => ({
                    ...prev,
                    phone_number: e.target.value,
                  }));
                }}
                placeholder='1234 5678'
                className={showPhoneNumberError ? errorInputClassName : ''}
                aria-invalid={showPhoneNumberError || undefined}
              />
              {showPhoneNumberError ? (
                <p className='text-xs text-red-600'>{phoneNumberError}</p>
              ) : null}
            </div>
            <div className='md:col-span-2 border-t border-slate-100 pt-4'>
              <p className='text-sm font-medium text-slate-700'>Social</p>
              <p className='text-xs text-slate-500'>
                Use @handle or https:// URLs for each network.
              </p>
            </div>
            {SOCIAL_FIELDS.map((field) => {
              const showError = showSocialError(field.key);
              return (
                <div key={field.key} className='space-y-1'>
                  <Label htmlFor={`org-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`org-${field.key}`}
                    value={panel.formState[field.key]}
                    onChange={(e) => {
                      markTouched(field.key);
                      panel.setFormState((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }));
                    }}
                    placeholder='@handle or https://...'
                    className={showError ? errorInputClassName : ''}
                    aria-invalid={showError || undefined}
                  />
                  {showError ? (
                    <p className='text-xs text-red-600'>
                      {socialErrors[field.key]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className='mt-4 flex flex-wrap gap-3'>
            <Button
              type='button'
              onClick={handleSubmit}
              disabled={panel.isSaving}
            >
              {panel.editingId ? 'Update Organization' : 'Add Organization'}
            </Button>
            {panel.editingId && isAdmin && (
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
      )}

      <Card
        title={isAdmin ? 'Existing Organizations' : 'Your Organizations'}
        description={
          isAdmin
            ? 'Select an organization to edit or delete.'
            : 'Organizations you own and manage.'
        }
      >
        {!showCreateForm && panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading organizations...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            {isAdmin
              ? 'No organizations yet.'
              : 'You do not own any organizations yet.'}
          </p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search organizations...'
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
                  ? 'No organizations match your search.'
                  : 'No organizations yet.'
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
