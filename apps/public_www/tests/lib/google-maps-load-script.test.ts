import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installGoogleMapsStub(options?: {
  readonly includeMap?: boolean;
  readonly importLibrary?: (name: string) => Promise<unknown>;
}): void {
  const includeMap = options?.includeMap ?? true;
  window.google = {
    maps: {
      ...(includeMap
        ? {
            Map: class {
              constructor() {}
            },
          }
        : {}),
      importLibrary:
        options?.importLibrary ??
        vi.fn().mockResolvedValue({}),
    } as typeof google.maps,
  };
}

describe('loadGoogleMapsScript', () => {
  beforeEach(() => {
    vi.resetModules();
    document.getElementById('siutindei-google-maps-script')?.remove();
    delete window.google;
  });

  afterEach(() => {
    document.getElementById('siutindei-google-maps-script')?.remove();
    delete window.google;
  });

  it('returns immediately when Map is already available', async () => {
    const { loadGoogleMapsScript } = await import(
      '@/lib/google-maps/load-script'
    );
    installGoogleMapsStub();

    await expect(loadGoogleMapsScript('test-key')).resolves.toBeUndefined();
    expect(document.getElementById('siutindei-google-maps-script')).toBeNull();
  });

  it('waits for importLibrary before treating the script as ready', async () => {
    const { loadGoogleMapsScript } = await import(
      '@/lib/google-maps/load-script'
    );
    let resolveImport: ((value: unknown) => void) | undefined;
    const importLibrary = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );

    const load = loadGoogleMapsScript('test-key');
    const script = document.getElementById(
      'siutindei-google-maps-script',
    ) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toContain('loading=async');

    installGoogleMapsStub({ includeMap: false, importLibrary });
    script?.dispatchEvent(new Event('load'));

    await vi.waitFor(() => {
      expect(importLibrary).toHaveBeenCalledWith('maps');
    });

    let settled = false;
    void load.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);

    installGoogleMapsStub({ importLibrary });
    resolveImport?.({});
    await expect(load).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });
});
