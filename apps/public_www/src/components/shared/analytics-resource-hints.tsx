const GTM_ORIGIN = 'https://www.googletagmanager.com';
const META_PIXEL_ORIGIN = 'https://connect.facebook.net';

export function AnalyticsResourceHints() {
  const hasGtm = Boolean(process.env.NEXT_PUBLIC_GTM_ID?.trim());
  const hasMetaPixel = Boolean(
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim(),
  );

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
