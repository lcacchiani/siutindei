'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '../components/ui/confirm-dialog';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

interface ConfirmDialogOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

const defaultState: ConfirmDialogState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: undefined,
  cancelLabel: undefined,
  variant: 'default',
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(defaultState);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeWithResult = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(defaultState);
  }, []);

  const confirm = useCallback(
    (
      title: string,
      message: string,
      options: ConfirmDialogOptions = {}
    ): Promise<boolean> =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setState({
          open: true,
          title,
          message,
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel,
          variant: options.variant ?? 'default',
        });
      }),
    []
  );

  useEffect(
    () => () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    },
    []
  );

  const confirmDialogElement = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={() => closeWithResult(true)}
      onCancel={() => closeWithResult(false)}
    />
  );

  return {
    confirm,
    ConfirmDialog: confirmDialogElement,
  };
}
