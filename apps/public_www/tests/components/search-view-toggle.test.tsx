import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchViewToggle } from '@/components/sections/search/search-view-toggle';

describe('SearchViewToggle', () => {
  it('shows the map icon while the list is visible', async () => {
    const onShowList = vi.fn();
    const onShowMap = vi.fn();

    render(
      <SearchViewToggle
        isMapView={false}
        listLabel="List"
        mapLabel="Map"
        onShowList={onShowList}
        onShowMap={onShowMap}
      />,
    );

    const toggle = await screen.findByRole('button', { name: 'Map' });
    expect(toggle.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/map.svg',
    );

    fireEvent.click(toggle);
    expect(onShowMap).toHaveBeenCalledOnce();
    expect(onShowList).not.toHaveBeenCalled();
  });

  it('shows the list icon while the map is visible', async () => {
    const onShowList = vi.fn();
    const onShowMap = vi.fn();

    render(
      <SearchViewToggle
        isMapView={true}
        listLabel="List"
        mapLabel="Map"
        onShowList={onShowList}
        onShowMap={onShowMap}
      />,
    );

    const toggle = await screen.findByRole('button', { name: 'List' });
    expect(toggle.querySelector('img')).toHaveAttribute(
      'src',
      '/images/ui/list.svg',
    );

    fireEvent.click(toggle);
    expect(onShowList).toHaveBeenCalledOnce();
    expect(onShowMap).not.toHaveBeenCalled();
  });
});
