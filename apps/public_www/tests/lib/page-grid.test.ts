import { describe, expect, it } from 'vitest';

import { validatePageBodyGrid } from '@/lib/page-grid/validate-grid';
import type { PageBodyGridConfig } from '@/lib/page-grid/types';

describe('validatePageBodyGrid', () => {
  it('accepts a valid 12-column layout', () => {
    const body: PageBodyGridConfig = {
      rows: [
        {
          cells: [{ component: 'hero', colStart: 1, colSpan: 12 }],
        },
        {
          cells: [
            { component: 'richText', colStart: 2, colSpan: 10 },
          ],
        },
      ],
    };

    expect(() => validatePageBodyGrid(body)).not.toThrow();
  });

  it('rejects cells that overflow the grid', () => {
    const body: PageBodyGridConfig = {
      rows: [
        {
          cells: [{ component: 'hero', colStart: 11, colSpan: 4 }],
        },
      ],
    };

    expect(() => validatePageBodyGrid(body)).toThrow(/exceeds/);
  });
});
