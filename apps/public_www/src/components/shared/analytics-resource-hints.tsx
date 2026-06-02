import { getGtmId, getMetaPixelId } from '@/lib/site-config';

const GTM_ORIGIN = 'https://www.googletagmanager.com';
const META_PIXEL_ORIGIN = 'https://connect.facebook.net';

export function AnalyticsResourceHints() {
  const hasGtm = getGtmId().length > 0;
  const hasMetaPixel = getMetaPixelId().length > 0;

  if (!hasGtm && !hasMetaPixel) {
    return null;
  }

  return (
    <>
      {hasGtm ? <link rel="preconnect" href={GTM_ORIGIN} /> : null}
      {hasMetaPixel ? (
        <link rel="preconnect" href={META_PIXEL_ORIGIN} />
      ) : null}
    </>
  );
}
