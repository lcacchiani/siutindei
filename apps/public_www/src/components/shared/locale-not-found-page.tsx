'use client';

import { usePathname } from 'next/navigation';

import { StatusPage } from '@/components/shared/status-page';
import { getContent } from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

export function LocaleNotFoundPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);
  const copy = content.common.errors.notFound;

  return (
    <StatusPage locale={locale} copy={copy} homeLabel={copy.homeLabel} />
  );
}
