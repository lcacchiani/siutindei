/**
 * Replaces `{key}` placeholders in copy templates (evolvesprouts pattern).
 */
export function formatContentTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      return match;
    }
    return String(value);
  });
}
