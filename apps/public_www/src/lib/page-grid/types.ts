export const PAGE_GRID_MAX_COLUMNS = 12;

export const PAGE_GRID_COMPONENT_IDS = [
  'hero',
  'features',
  'richText',
] as const;

export type PageGridComponentId = (typeof PAGE_GRID_COMPONENT_IDS)[number];

export interface PageGridCellConfig {
  readonly component: string;
  readonly colStart?: number;
  readonly colSpan: number;
  readonly props?: Record<string, unknown>;
}

export interface PageGridRowConfig {
  readonly cells: readonly PageGridCellConfig[];
}

export interface PageBodyGridConfig {
  readonly rows: readonly PageGridRowConfig[];
}
