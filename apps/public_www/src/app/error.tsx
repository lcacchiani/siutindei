'use client';

import { LocaleChromeStatusPage } from '@/components/shared/locale-chrome-status-page';

interface RootErrorPageProps {
  readonly reset: () => void;
}

export default function RootErrorPage({ reset }: RootErrorPageProps) {
  return <LocaleChromeStatusPage variant="serverError" onRetry={reset} />;
}
