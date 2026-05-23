'use client';

import { useEffect } from 'react';

interface StaticLocaleRedirectProps {
  readonly href: string;
  readonly message: string;
  readonly linkLabel: string;
}

export function StaticLocaleRedirect({
  href,
  message,
  linkLabel,
}: StaticLocaleRedirectProps) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-6">
      <div className="max-w-md text-center">
        <p className="text-base text-ink-700">{message}</p>
        <a
          href={href}
          className="mt-6 inline-block rounded-full bg-brand-500 px-5 py-2 font-semibold text-white transition hover:bg-brand-600"
        >
          {linkLabel}
        </a>
      </div>
    </main>
  );
}
