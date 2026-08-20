'use client';

import { useEffect, useRef } from 'react';

import type { SmallWorldSceneHandle } from '@/lib/small-world/scene';

interface SmallWorldSceneProps {
  /** Called once the WebGL scene is running, to fade out the fallback. */
  readonly onReady?: () => void;
}

/**
 * Lazily mounts the three.js "small world" scene when the hero becomes
 * visible. Skips entirely for reduced-motion users and environments
 * without WebGL, leaving the static bubble illustrations in place.
 */
export function SmallWorldScene({ onReady }: SmallWorldSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      return;
    }
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let handle: SmallWorldSceneHandle | null = null;
    let loading = false;
    let cancelled = false;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      if (handle) {
        handle.setPaused(!entry.isIntersecting);
        return;
      }
      if (!entry.isIntersecting || loading) {
        return;
      }
      loading = true;
      import('@/lib/small-world/scene')
        .then((module) => {
          if (cancelled) {
            return;
          }
          handle = module.createSmallWorldScene(host);
          if (handle) {
            onReadyRef.current?.();
          }
        })
        .catch(() => {
          /* three.js failed to load; the static fallback stays visible. */
        });
    });
    observer.observe(host);

    const onVisibilityChange = () => {
      handle?.setPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      handle?.dispose();
      handle = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="small-world-hero__canvas-host"
      aria-hidden="true"
    />
  );
}
