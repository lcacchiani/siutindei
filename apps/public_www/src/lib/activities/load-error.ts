/**
 * Logs activity fetch failures in development. Production keeps the generic UI
 * copy only; env values must use static `process.env.NEXT_PUBLIC_*` access
 * (see site-config.ts) so Next.js inlines them in the client bundle.
 */
export function logActivityLoadError(
  context: string,
  error: unknown,
): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  console.error(`[activities] ${context}`, error);
}
