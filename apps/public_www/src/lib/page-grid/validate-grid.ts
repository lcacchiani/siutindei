import { PAGE_GRID_MAX_COLUMNS, type PageBodyGridConfig } from './types';

export function validatePageBodyGrid(body: PageBodyGridConfig): void {
  for (const [rowIndex, row] of body.rows.entries()) {
    if (row.cells.length === 0) {
      throw new Error(`Page grid row ${rowIndex} has no cells.`);
    }

    let occupiedColumns = 0;
    for (const [cellIndex, cell] of row.cells.entries()) {
      const colStart = cell.colStart ?? 1;
      const colSpan = cell.colSpan;

      if (colStart < 1 || colStart > PAGE_GRID_MAX_COLUMNS) {
        throw new Error(
          `Row ${rowIndex} cell ${cellIndex}: colStart must be 1–${PAGE_GRID_MAX_COLUMNS}.`,
        );
      }

      if (colSpan < 1 || colSpan > PAGE_GRID_MAX_COLUMNS) {
        throw new Error(
          `Row ${rowIndex} cell ${cellIndex}: colSpan must be 1–${PAGE_GRID_MAX_COLUMNS}.`,
        );
      }

      if (colStart + colSpan - 1 > PAGE_GRID_MAX_COLUMNS) {
        throw new Error(
          `Row ${rowIndex} cell ${cellIndex}: cell exceeds the ${PAGE_GRID_MAX_COLUMNS}-column grid.`,
        );
      }

      occupiedColumns += colSpan;
    }

    if (occupiedColumns > PAGE_GRID_MAX_COLUMNS) {
      throw new Error(
        `Row ${rowIndex}: total colSpan (${occupiedColumns}) exceeds ${PAGE_GRID_MAX_COLUMNS}.`,
      );
    }
  }
}
