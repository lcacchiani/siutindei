export function isExternalHref(href: string): boolean {
  const value = href.trim();
  return /^https?:\/\//i.test(value) || value.startsWith('mailto:');
}

export function getHrefKind(href: string): 'internal' | 'external' | 'unsafe' {
  const value = href.trim();
  if (value === '' || value === '#') {
    return 'internal';
  }

  if (/^javascript:/i.test(value)) {
    return 'unsafe';
  }

  if (isExternalHref(value)) {
    return 'external';
  }

  return 'internal';
}
