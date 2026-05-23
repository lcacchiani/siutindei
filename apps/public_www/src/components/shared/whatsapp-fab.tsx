import { getSiteConfig } from '@/lib/site-config';

interface WhatsappFabProps {
  readonly label: string;
}

export function WhatsappFab({ label }: WhatsappFabProps) {
  const { contact } = getSiteConfig();

  if (!contact.whatsappUrl) {
    return null;
  }

  return (
    <a
      href={contact.whatsappUrl}
      className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-600 sm:hidden"
      target="_blank"
      rel="noreferrer noopener"
    >
      {label}
    </a>
  );
}
