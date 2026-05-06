import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">
          404
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-900">
          Page not found
        </h1>
        <p className="mt-3 text-base text-ink-700">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-brand-500 px-5 py-2 font-semibold text-white transition hover:bg-brand-600"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
