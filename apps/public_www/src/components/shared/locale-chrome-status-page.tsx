'use client';

import { usePathname } from 'next/navigation';

import { PageLayout } from '@/components/shared/page-layout';
import { StatusPage } from '@/components/shared/status-page';
import { getContent } from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

interface LocaleChromeStatusPageProps {
  readonly variant: 'notFound' | 'serverError';
  readonly onRetry?: () => void;
}

export function LocaleChromeStatusPage({
  variant,
  onRetry,
}: LocaleChromeStatusPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);
  const copy =
    variant === 'notFound'
      ? content.common.errors.notFound
      : content.common.errors.serverError;

  return (
    <PageLayout
      locale={locale}
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <StatusPage
        locale={locale}
        copy={copy}
        homeLabel={content.common.errors.notFound.homeLabel}
        action={
          variant === 'serverError' && onRetry
            ? {
                label: content.common.errors.serverError.retryLabel,
                onClick: onRetry,
              }
            : undefined
        }
      />
    </PageLayout>
  );
}
