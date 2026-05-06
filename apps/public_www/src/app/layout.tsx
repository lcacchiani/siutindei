import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { getSiteConfig } from '@/lib/site-config';
import './globals.css';

const siteConfig = getSiteConfig();

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteOrigin),
  title: {
    default: siteConfig.siteName,
    template: `%s · ${siteConfig.siteName}`,
  },
  description: siteConfig.siteTagline,
  applicationName: siteConfig.siteName,
  openGraph: {
    type: 'website',
    siteName: siteConfig.siteName,
    title: siteConfig.siteName,
    description: siteConfig.siteTagline,
    url: siteConfig.siteOrigin,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.siteName,
    description: siteConfig.siteTagline,
  },
};

export const viewport: Viewport = {
  themeColor: '#3a5ba0',
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        {siteConfig.stagingBadgeEnabled ? (
          <Script
            src="/scripts/show-staging-badge.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
