'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SearchViewToggleProps {
  readonly isMapView: boolean;
  readonly listLabel: string;
  readonly mapLabel: string;
  readonly onShowList: () => void;
  readonly onShowMap: () => void;
}

const LIST_ICON_SRC = '/images/ui/list.svg';
const MAP_ICON_SRC = '/images/ui/map.svg';

export function SearchViewToggle({
  isMapView,
  listLabel,
  mapLabel,
  onShowList,
  onShowMap,
}: SearchViewToggleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const nextIsMap = !isMapView;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <button
      type="button"
      aria-label={nextIsMap ? mapLabel : listLabel}
      onClick={nextIsMap ? onShowMap : onShowList}
      className={
        'search-view-toggle fixed bottom-4 left-4 z-40 inline-flex h-12 ' +
        'w-12 items-center justify-center rounded-full border ' +
        'border-ink-900/15 bg-white shadow-lg transition hover:bg-brand-50'
      }
    >
      <img
        src={nextIsMap ? MAP_ICON_SRC : LIST_ICON_SRC}
        alt=""
        width={20}
        height={20}
        decoding="async"
        aria-hidden="true"
        className="h-5 w-5"
      />
    </button>,
    document.body,
  );
}
