import { getSiteConfig } from '@/lib/site-config';

export function Footer() {
  const { siteName, contact } = getSiteConfig();
  const year = new Date().getFullYear();

  return (
    <footer
      id="contact"
      className="bg-brand-700 text-brand-100"
      data-section-id="footer"
    >
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-lg font-semibold text-white">{siteName}</p>
            <p className="mt-2 text-sm text-brand-100">
              An LX Software product. Hong Kong, SAR.
            </p>
          </div>
          <div className="text-sm sm:text-right">
            {contact.email ? (
              <p>
                <a
                  href={`mailto:${contact.email}`}
                  className="underline-offset-2 hover:underline"
                >
                  {contact.email}
                </a>
              </p>
            ) : null}
            {contact.whatsappUrl ? (
              <p className="mt-1">
                <a
                  href={contact.whatsappUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-offset-2 hover:underline"
                >
                  WhatsApp
                </a>
              </p>
            ) : null}
            {contact.instagramUrl ? (
              <p className="mt-1">
                <a
                  href={contact.instagramUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-offset-2 hover:underline"
                >
                  Instagram
                </a>
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-8 border-t border-brand-600 pt-6 text-xs text-brand-100">
          &copy; {year} LX Software Limited. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
