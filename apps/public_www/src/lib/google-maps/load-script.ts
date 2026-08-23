'use client';

const SCRIPT_ID = 'siutindei-google-maps-script';
let loadPromise: Promise<void> | null = null;

function hasMapsConstructor(): boolean {
  return typeof window.google?.maps?.Map === 'function';
}

export async function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps requires a browser.');
  }

  if (hasMapsConstructor()) {
    return;
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Google Maps failed to load.')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        '&loading=async';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load.'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  }

  await loadPromise;

  const importLibrary = window.google?.maps?.importLibrary;
  if (typeof importLibrary === 'function') {
    await importLibrary('maps');
  }

  if (!hasMapsConstructor()) {
    throw new Error('Google Maps failed to load.');
  }
}
