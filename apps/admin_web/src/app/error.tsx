'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error: _error, reset }: GlobalErrorProps) {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center'>
      <h1 className='text-xl font-semibold text-slate-900'>Something went wrong</h1>
      <p className='text-sm text-slate-600'>
        We could not load this page. Please try again.
      </p>
      <button
        type='button'
        onClick={reset}
        className='rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
      >
        Try Again
      </button>
    </main>
  );
}
