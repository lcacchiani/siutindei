import type { FooterContent } from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { getCopyrightYear, getSiteConfig } from '@/lib/site-config';

interface FooterProps {
  readonly content: FooterContent;
}

export function Footer({ content }: FooterProps) {
  const { siteName, contact } = getSiteConfig();
  const year = getCopyrightYear();
  const copyright = formatContentTemplate(content.copyrightTemplate, {
    year: String(year),
  });

  return (
    <footer
      id="contact"
      className="bg-brand-700 text-brand-100"
      data-section-id="footer"
    >
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-lg font-semibold text-white">{siteName}</p>
            <p className="mt-2 text-sm text-brand-100">{content.tagline}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold text-white">{content.contactHeading}</p>
            {contact.email ? (
              <p className="mt-2">
                <a
                  href={`mailto:${contact.email}`}
                  className="underline-offset-2 hover:underline"
                >
                  {contact.email}
                </a>
              </p>
            ) : null}
            {contact.whatsappUrl ? (
              <p className="mt-1 hidden sm:block">
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
          {copyright}
        </p>
      </div>
    </footer>
  );
}
