function trimEnv(value: string | undefined): string {
  return (value ?? '').trim();
}

export interface GoogleMapsConfig {
  readonly apiKey: string;
}

export function getGoogleMapsConfig(): GoogleMapsConfig {
  return {
    apiKey: trimEnv(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
  };
}

export function isGoogleMapsEnabled(): boolean {
  return getGoogleMapsConfig().apiKey.length > 0;
}
