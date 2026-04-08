import { useCallback, type MutableRefObject, useState } from 'react';
import type { CreateRowState, TableField } from '../types';
import { buildFieldUpdateValue } from '../valueNormalization';

interface UseTableCreateRowArgs {
  fieldById: Map<string, TableField>;
  createTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  onCreateRecord?: (payload: { title: string; fields: Record<string, unknown> }) => Promise<void>;
}

interface UseTableCreateRowResult {
  createRow: CreateRowState;
  setCreateRow: React.Dispatch<React.SetStateAction<CreateRowState>>;
  submitCreateRow: () => Promise<void>;
}

export const useTableCreateRow = ({ fieldById, createTitleInputRef, onCreateRecord }: UseTableCreateRowArgs): UseTableCreateRowResult => {
  const [createRow, setCreateRow] = useState<CreateRowState>({
    title: '',
    fields: {},
    error: null,
    isSubmitting: false,
  });

  const submitCreateRow = useCallback(async () => {
    if (!onCreateRecord || createRow.isSubmitting) {
      return;
    }

    const trimmedTitle = createRow.title.trim();
    if (!trimmedTitle) {
      setCreateRow((current) => ({ ...current, error: 'Title is required.' }));
      return;
    }

    const fieldsPayload = Object.entries(createRow.fields).reduce<Record<string, unknown>>((accumulator, [fieldId, value]) => {
      const field = fieldById.get(fieldId);
      if (!field) {
        return accumulator;
      }

      const normalizedValue = field.type === 'text' ? value : value.trim();
      if (!normalizedValue) {
        return accumulator;
      }

      accumulator[fieldId] = buildFieldUpdateValue(field, normalizedValue);
      return accumulator;
    }, {});

    setCreateRow((current) => ({ ...current, isSubmitting: true, error: null }));

    try {
      await onCreateRecord({ title: trimmedTitle, fields: fieldsPayload });
      setCreateRow({
        title: '',
        fields: {},
        error: null,
        isSubmitting: false,
      });
      createTitleInputRef.current?.focus();
    } catch (error) {
      setCreateRow((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to create record.',
        isSubmitting: false,
      }));
    }
  }, [createRow, createTitleInputRef, fieldById, onCreateRecord]);

  return {
    createRow,
    setCreateRow,
    submitCreateRow,
  };
};
