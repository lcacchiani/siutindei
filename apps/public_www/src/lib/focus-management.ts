export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function setInertOnElements(
  elementIds: readonly string[],
  inert: boolean,
): () => void {
  const targets = elementIds
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element instanceof HTMLElement);

  const hadInert = targets.map((element) => element.hasAttribute('inert'));

  if (inert) {
    targets.forEach((element) => {
      element.setAttribute('inert', '');
    });
  }

  return () => {
    targets.forEach((element, index) => {
      if (hadInert[index]) {
        element.setAttribute('inert', '');
      } else {
        element.removeAttribute('inert');
      }
    });
  };
}

export function handleFocusTrapKeyDown(
  event: KeyboardEvent,
  container: HTMLElement,
): void {
  if (event.key !== 'Tab') {
    return;
  }

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
