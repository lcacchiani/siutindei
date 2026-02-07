'use client';

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
