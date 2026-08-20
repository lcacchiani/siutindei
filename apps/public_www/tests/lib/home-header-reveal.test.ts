import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HERO_SEARCH_SENTINEL_ATTR,
  shouldRevealHomeHeader,
  subscribeHomeHeaderReveal,
} from '@/lib/home-header-reveal';

let observerInstances: MockIntersectionObserver[] = [];
let observerCallback:
  | ((entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void)
  | null = null;

class MockIntersectionObserver {
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = () => [];
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(
    callback: (
      entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[],
    ) => void,
  ) {
    observerCallback = callback;
    observerInstances.push(this);
  }
}

function emitIntersection(isIntersecting: boolean) {
  observerCallback?.([{ isIntersecting }]);
}

function mountSentinel() {
  const sentinel = document.createElement('div');
  sentinel.setAttribute(HERO_SEARCH_SENTINEL_ATTR, '');
  document.body.append(sentinel);
  return sentinel;
}

describe('shouldRevealHomeHeader', () => {
  it('reveals only after the hero search box leaves view', () => {
    expect(shouldRevealHomeHeader(true)).toBe(false);
    expect(shouldRevealHomeHeader(false)).toBe(true);
  });
});

describe('subscribeHomeHeaderReveal', () => {
  beforeEach(() => {
    observerInstances = [];
    observerCallback = null;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('observes an existing sentinel and reports reveal changes', () => {
    mountSentinel();
    const onRevealChange = vi.fn();

    const unsubscribe = subscribeHomeHeaderReveal(onRevealChange);

    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0]?.observe).toHaveBeenCalledTimes(1);

    emitIntersection(true);
    expect(onRevealChange).toHaveBeenLastCalledWith(false);

    emitIntersection(false);
    expect(onRevealChange).toHaveBeenLastCalledWith(true);

    unsubscribe();
    expect(observerInstances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('waits for the sentinel to mount when it is missing', async () => {
    const onRevealChange = vi.fn();
    const unsubscribe = subscribeHomeHeaderReveal(onRevealChange);

    expect(observerInstances).toHaveLength(0);

    mountSentinel();

    await vi.waitFor(() => {
      expect(observerInstances).toHaveLength(1);
    });
    emitIntersection(false);
    expect(onRevealChange).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it('does nothing when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onRevealChange = vi.fn();

    const unsubscribe = subscribeHomeHeaderReveal(onRevealChange);
    unsubscribe();

    expect(onRevealChange).not.toHaveBeenCalled();
  });
});
