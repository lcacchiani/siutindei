import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/components/shared/ui/modal';

describe('Modal', () => {
  it('inerts page content and focuses the first field in the body', () => {
    render(
      <>
        <main id="main-content">
          <button type="button">Outside</button>
        </main>
        <footer id="contact">Footer</footer>
        <Modal isOpen title="Search filters" onClose={vi.fn()}>
          <button type="button">First field</button>
          <button type="button">Second field</button>
        </Modal>
      </>,
    );

    const main = document.getElementById('main-content');
    expect(main?.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('contact')?.hasAttribute('inert')).toBe(
      true,
    );
    expect(document.body.classList.contains('navbar-mobile-menu-scroll-lock'))
      .toBe(true);

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'First field' }),
    );
  });
});
