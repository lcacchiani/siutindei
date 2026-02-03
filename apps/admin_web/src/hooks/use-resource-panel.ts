'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  ApiMode,
  getResourceApi,
  ResourceType,
} from '../lib/resource-api';

interface ResourcePanelState<T> {
  items: T[];
  nextCursor: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  editingId: string | null;
}

interface ResourcePanelActions<T, TForm> {
  loadItems: (cursor?: string) => Promise<void>;
  loadMore: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  startEdit: (item: T & { id: string }) => void;
  resetForm: () => void;
  handleSubmit: (
    formToPayload: (form: TForm) => unknown,
    validate?: () => string | null
  ) => Promise<void>;
  handleDelete: (item: T & { id: string; name?: string }) => Promise<void>;
  formState: TForm;
  setFormState: React.Dispatch<React.SetStateAction<TForm>>;
}

export function useResourcePanel<T extends { id: string }, TForm>(
  resource: ResourceType,
  mode: ApiMode,
  emptyForm: TForm,
  itemToForm: (item: T) => TForm
): ResourcePanelState<T> & ResourcePanelActions<T, TForm> {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TForm>(emptyForm);

  const api = useMemo(() => getResourceApi<T>(resource, mode), [resource, mode]);

  const loadItems = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.list(cursor);
        setItems((prev) =>
          cursor ? [...prev, ...response.items] : response.items
        );
        setNextCursor(response.next_cursor ?? null);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : `Failed to load ${resource}.`;
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [api, resource]
  );

  const loadMore = useCallback(() => {
    if (nextCursor) {
      loadItems(nextCursor);
    }
  }, [loadItems, nextCursor]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const clearError = useCallback(() => setError(''), []);

  const startEdit = useCallback(
    (item: T & { id: string }) => {
      setEditingId(item.id);
      setFormState(itemToForm(item));
    },
    [itemToForm]
  );

  const resetForm = useCallback(() => {
    setFormState(emptyForm);
    setEditingId(null);
  }, [emptyForm]);

  const handleSubmit = useCallback(
    async (
      formToPayload: (form: TForm) => unknown,
      validate?: () => string | null
    ) => {
      if (validate) {
        const validationError = validate();
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      setIsSaving(true);
      setError('');
      try {
        const payload = formToPayload(formState);
        if (editingId) {
          const updated = await api.update(editingId, payload);
          setItems((prev) =>
            prev.map((item) => (item.id === editingId ? updated : item))
          );
        } else if (api.create) {
          const created = await api.create(payload);
          setItems((prev) => [created, ...prev]);
        } else {
          setError('Creating new items is not allowed.');
          return;
        }
        resetForm();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : `Unable to save ${resource.slice(0, -1)}.`;
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [api, editingId, formState, resetForm, resource]
  );

  const handleDelete = useCallback(
    async (item: T & { id: string; name?: string }) => {
      const displayName = item.name || item.id;
      const confirmed = window.confirm(
        `Delete ${resource.slice(0, -1)} "${displayName}"? This cannot be undone.`
      );
      if (!confirmed) return;

      setError('');
      try {
        await api.delete(item.id);
        setItems((prev) => prev.filter((entry) => entry.id !== item.id));
        if (editingId === item.id) {
          resetForm();
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : `Unable to delete ${resource.slice(0, -1)}.`;
        setError(message);
      }
    },
    [api, editingId, resetForm, resource]
  );

  return {
    // State
    items,
    nextCursor,
    isLoading,
    isSaving,
    error,
    editingId,
    formState,
    // Actions
    loadItems,
    loadMore,
    setError,
    clearError,
    startEdit,
    resetForm,
    handleSubmit,
    handleDelete,
    setFormState,
  };
}
