'use client';

const SCRIPT_ID = 'siutindei-google-maps-script';
let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps requires a browser.'));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

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
  });

  return loadPromise;
}
