export function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}
