import { getGoogleMapsApiKey } from '@/lib/site-config';

export interface GoogleMapsConfig {
  readonly apiKey: string;
}

export function getGoogleMapsConfig(): GoogleMapsConfig {
  return {
    apiKey: getGoogleMapsApiKey(),
  };
}

export function isGoogleMapsEnabled(): boolean {
  return getGoogleMapsConfig().apiKey.length > 0;
}
