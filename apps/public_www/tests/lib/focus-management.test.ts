import { describe, expect, it } from 'vitest';

import { handleFocusTrapKeyDown } from '@/lib/focus-management';

describe('handleFocusTrapKeyDown', () => {
  it('wraps focus from first to last on Shift+Tab', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    first.textContent = 'First';
    const last = document.createElement('button');
    last.textContent = 'Last';
    container.append(first, last);
    document.body.append(container);
    first.focus();

    handleFocusTrapKeyDown(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
      container,
    );

    expect(document.activeElement).toBe(last);
    container.remove();
  });
});
