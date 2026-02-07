'use client';

const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPriceAmount(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    return priceFormatter.format(parsed);
  }

  if (!Number.isFinite(value)) {
    return String(value);
  }

  return priceFormatter.format(value);
}
