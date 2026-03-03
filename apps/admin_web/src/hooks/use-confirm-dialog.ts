'use client';

import {
  createElement,
  useCallback,
  useEffect,
  useState,
  type ReactElement,
} from 'react';

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

interface UseConfirmDialogResult {
  confirm: (
    title: string,
    message: string,
    options?: ConfirmDialogOptions
  ) => Promise<boolean>;
  confirmDialog: ReactElement;
}

const defaultState: ConfirmDialogState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: undefined,
  cancelLabel: undefined,
  variant: 'default',
};

export function useConfirmDialog(): UseConfirmDialogResult {
  const [state, setState] = useState<ConfirmDialogState>(defaultState);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null
  );

  const closeWithResult = useCallback((result: boolean) => {
    resolver?.(result);
    setResolver(null);
    setState(defaultState);
  }, [resolver]);

  const confirm = useCallback(
    (
      title: string,
      message: string,
      options: ConfirmDialogOptions = {}
    ): Promise<boolean> =>
      new Promise((resolve) => {
        setResolver(() => resolve);
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
      if (resolver) {
        resolver(false);
      }
    },
    [resolver]
  );

  const handleConfirm = useCallback(() => {
    closeWithResult(true);
  }, [closeWithResult]);
  const handleCancel = useCallback(() => {
    closeWithResult(false);
  }, [closeWithResult]);

  const confirmDialog = createElement(ConfirmDialog, {
    open: state.open,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    variant: state.variant,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  });

  return {
    confirm,
    confirmDialog,
  };
}
