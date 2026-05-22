const GTM_SCRIPT_PATH = '/scripts/init-gtm.js';

export function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) {
    return null;
  }

  return <script src={GTM_SCRIPT_PATH} async />;
}
