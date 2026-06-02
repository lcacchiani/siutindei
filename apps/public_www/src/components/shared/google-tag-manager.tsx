import { getGtmId } from '@/lib/site-config';

const GTM_SCRIPT_PATH = '/scripts/init-gtm.js';

export function GoogleTagManager() {
  const gtmId = getGtmId();
  if (!gtmId) {
    return null;
  }

  return <script src={GTM_SCRIPT_PATH} async />;
}
