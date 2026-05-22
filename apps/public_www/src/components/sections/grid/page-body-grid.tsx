import type { Locale, SiteContent } from '@/content';
import { FeaturesSection } from '@/components/sections/grid/features-section';
import { HeroSection } from '@/components/sections/grid/hero-section';
import { RichTextSection } from '@/components/sections/grid/rich-text-section';
import type {
  PageBodyGridConfig,
  PageGridCellConfig,
  PageGridComponentId,
} from '@/lib/page-grid/types';
import { PAGE_GRID_COMPONENT_IDS } from '@/lib/page-grid/types';
import { validatePageBodyGrid } from '@/lib/page-grid/validate-grid';

interface PageBodyGridProps {
  readonly locale: Locale;
  readonly content: SiteContent;
  readonly body: PageBodyGridConfig;
}

function readStringProp(
  props: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = props?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function readStringArrayProp(
  props: Record<string, unknown> | undefined,
  key: string,
): readonly string[] {
  const value = props?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function isPageGridComponentId(value: string): value is PageGridComponentId {
  return (PAGE_GRID_COMPONENT_IDS as readonly string[]).includes(value);
}

function renderGridCell(
  locale: Locale,
  content: SiteContent,
  cell: PageGridCellConfig,
) {
  const props = cell.props;

  if (!isPageGridComponentId(cell.component)) {
    return null;
  }

  switch (cell.component) {
    case 'hero':
      return (
        <HeroSection
          locale={locale}
          content={content.hero}
          eyebrow={readStringProp(props, 'eyebrow', '')}
          primaryCtaLabel={readStringProp(props, 'primaryCtaLabel', '')}
          primaryCtaHref={readStringProp(props, 'primaryCtaHref', '/')}
          secondaryCtaLabel={readStringProp(props, 'secondaryCtaLabel', '')}
          secondaryCtaHref={readStringProp(props, 'secondaryCtaHref', '#contact')}
        />
      );
    case 'features':
      return <FeaturesSection content={content.features} />;
    case 'richText':
      return (
        <RichTextSection
          title={readStringProp(props, 'title', '')}
          paragraphs={readStringArrayProp(props, 'paragraphs')}
        />
      );
    default:
      return null;
  }
}

export function PageBodyGrid({ locale, content, body }: PageBodyGridProps) {
  validatePageBodyGrid(body);

  return (
    <div className="page-body-grid">
      {body.rows.map((row, rowIndex) => (
        <div
          key={`page-grid-row-${rowIndex}`}
          className="page-body-grid__row mx-auto grid max-w-7xl grid-cols-12 gap-x-4 gap-y-0 px-4 sm:px-6 lg:px-8"
        >
          {row.cells.map((cell, cellIndex) => {
            const colStart = cell.colStart ?? 1;
            const colSpan = cell.colSpan;
            const columnClass = `col-[${colStart}_/span_${colSpan}]`;

            return (
              <div
                key={`page-grid-cell-${rowIndex}-${cellIndex}`}
                className={`page-body-grid__cell min-w-0 ${columnClass}`}
                data-grid-col-start={colStart}
                data-grid-col-span={colSpan}
                data-component={cell.component}
              >
                {renderGridCell(locale, content, cell)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
