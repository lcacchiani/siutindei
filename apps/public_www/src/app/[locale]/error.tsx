'use client';

import { LocaleErrorPage } from '@/components/shared/locale-error-page';

interface LocaleErrorBoundaryProps {
  readonly reset: () => void;
}

export default function LocaleErrorBoundary({ reset }: LocaleErrorBoundaryProps) {
  return <LocaleErrorPage reset={reset} />;
}
