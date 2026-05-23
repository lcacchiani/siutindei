'use client';

import { usePathname } from 'next/navigation';

import { StatusPage } from '@/components/shared/status-page';
import { getContent } from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

interface LocaleErrorPageProps {
  readonly reset: () => void;
}

export function LocaleErrorPage({ reset }: LocaleErrorPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);
  const copy = content.common.errors.serverError;

  return (
    <StatusPage
      locale={locale}
      copy={copy}
      homeLabel={content.common.errors.notFound.homeLabel}
      action={{
        label: copy.retryLabel,
        onClick: reset,
      }}
    />
  );
}
