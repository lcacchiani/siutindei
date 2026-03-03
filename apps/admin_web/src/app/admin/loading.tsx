export default function AdminLoading() {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6'>
      <div
        className='h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700'
        aria-hidden='true'
      />
      <p className='text-sm text-slate-600'>Loading admin workspace...</p>
    </main>
  );
}
