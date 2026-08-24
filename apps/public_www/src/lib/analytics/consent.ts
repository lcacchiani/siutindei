export const ANALYTICS_CONSENT_STORAGE_KEY =
  'siutindei-analytics-consent';
export const ANALYTICS_CONSENT_GRANTED_EVENT =
  'siutindei-analytics-consent-granted';

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) ===
      'granted'
    );
  } catch {
    return false;
  }
}
