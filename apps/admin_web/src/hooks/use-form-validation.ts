'use client';

import {
  createElement,
  useCallback,
  useMemo,
  useState,
  type ReactElement,
} from 'react';

interface UseFormValidationResult {
  touched: Record<string, boolean>;
  hasSubmitted: boolean;
  markTouched: (field: string) => void;
  markAllTouched: () => void;
  setHasSubmitted: (value: boolean) => void;
  shouldShowError: (field: string, isInvalid: boolean) => boolean;
  errorClassName: (field: string, isInvalid: boolean) => string;
  requiredIndicator: ReactElement;
  resetValidation: () => void;
}

interface ValidationState {
  key: unknown;
  touched: Record<string, boolean>;
  hasSubmitted: boolean;
}

const formErrorClassName =
  'border-red-500 focus:border-red-500 focus:ring-red-500';

export function useFormValidation(
  fields: readonly string[],
  resetDependency: unknown
): UseFormValidationResult {
  const [state, setState] = useState<ValidationState>(() => ({
    key: resetDependency,
    touched: {},
    hasSubmitted: false,
  }));

  const touched = useMemo(
    () =>
      state.key === resetDependency
        ? state.touched
        : ({} as Record<string, boolean>),
    [resetDependency, state.key, state.touched]
  );

  const hasSubmitted =
    state.key === resetDependency ? state.hasSubmitted : false;

  const ensureCurrentState = useCallback(
    (previous: ValidationState): ValidationState =>
      previous.key === resetDependency
        ? previous
        : {
            key: resetDependency,
            touched: {},
            hasSubmitted: false,
          },
    [resetDependency]
  );

  const resetValidation = useCallback(() => {
    setState({
      key: resetDependency,
      touched: {},
      hasSubmitted: false,
    });
  }, [resetDependency]);

  const markTouched = useCallback(
    (field: string) => {
      setState((prev) => {
        const current = ensureCurrentState(prev);
        if (current.touched[field]) {
          return current;
        }
        return {
          ...current,
          touched: { ...current.touched, [field]: true },
        };
      });
    },
    [ensureCurrentState]
  );

  const markAllTouched = useCallback(() => {
    const touchedFields: Record<string, boolean> = {};
    for (const field of fields) {
      touchedFields[field] = true;
    }
    setState((prev) => ({
      ...ensureCurrentState(prev),
      touched: touchedFields,
    }));
  }, [ensureCurrentState, fields]);

  const setHasSubmitted = useCallback(
    (value: boolean) => {
      setState((prev) => {
        const current = ensureCurrentState(prev);
        if (current.hasSubmitted === value) {
          return current;
        }
        return { ...current, hasSubmitted: value };
      });
    },
    [ensureCurrentState]
  );

  const shouldShowError = useCallback(
    (field: string, isInvalid: boolean) =>
      isInvalid && (hasSubmitted || Boolean(touched[field])),
    [hasSubmitted, touched]
  );

  const errorClassName = useCallback(
    (field: string, isInvalid: boolean) =>
      shouldShowError(field, isInvalid) ? formErrorClassName : '',
    [shouldShowError]
  );

  const requiredIndicator = useMemo(
    () =>
      createElement(
        'span',
        { className: 'ml-0.5 text-red-500', 'aria-hidden': true },
        '*'
      ),
    []
  );

  return {
    touched,
    hasSubmitted,
    markTouched,
    markAllTouched,
    setHasSubmitted,
    shouldShowError,
    errorClassName,
    requiredIndicator,
    resetValidation,
  };
}
