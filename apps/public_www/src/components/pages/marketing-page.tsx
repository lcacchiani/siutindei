import type { Locale, PageBodyGridConfig, SiteContent } from '@/content';
import { PageBodyGrid } from '@/components/sections/grid/page-body-grid';
import { PageLayout } from '@/components/shared/page-layout';

interface MarketingPageProps {
  readonly locale: Locale;
  readonly content: SiteContent;
  readonly body: PageBodyGridConfig;
  readonly currentPath: string;
}

export function MarketingPage({
  locale,
  content,
  body,
  currentPath,
}: MarketingPageProps) {
  return (
    <PageLayout
      locale={locale}
      navbarContent={content.navbar}
      footerContent={content.footer}
      currentPath={currentPath}
    >
      <PageBodyGrid locale={locale} content={content} body={body} />
    </PageLayout>
  );
}
