import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EditableCellState, TableField } from '../types';
import { buildFieldUpdateValue } from '../valueNormalization';

interface UseTableInlineEditingArgs {
  fieldById: Map<string, TableField>;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
}

interface UseTableInlineEditingResult {
  editableCell: EditableCellState | null;
  setEditableCell: React.Dispatch<React.SetStateAction<EditableCellState | null>>;
  submitEditableCell: () => Promise<void>;
  handleEditableCellBlur: () => Promise<void>;
  handleEditableCellKeyDown: (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => Promise<void>;
}

export const useTableInlineEditing = ({ fieldById, onUpdateRecord }: UseTableInlineEditingArgs): UseTableInlineEditingResult => {
  const skipEditableBlurRef = useRef(false);
  const editableSubmitInFlightRef = useRef(false);
  const [editableCell, setEditableCell] = useState<EditableCellState | null>(null);

  const submitEditableCell = useCallback(async () => {
    if (!editableCell || !onUpdateRecord || editableSubmitInFlightRef.current) {
      return;
    }
    editableSubmitInFlightRef.current = true;

    const field = editableCell.fieldId === 'title' ? null : fieldById.get(editableCell.fieldId) ?? null;
    const nextValue = field ? editableCell.value : editableCell.value.trim();
    const baselineValue = field ? editableCell.baseline : editableCell.baseline.trim();

    if (!field && !nextValue) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
          ? { ...current, error: 'Title is required.' }
          : current,
      );
      editableSubmitInFlightRef.current = false;
      return;
    }

    if (nextValue === baselineValue) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId ? null : current,
      );
      editableSubmitInFlightRef.current = false;
      return;
    }

    setEditableCell((current) =>
      current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
        ? { ...current, error: null, value: nextValue }
        : current,
    );

    try {
      await onUpdateRecord(editableCell.recordId, {
        [editableCell.fieldId]: field ? buildFieldUpdateValue(field, nextValue) : nextValue,
      });
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId ? null : current,
      );
    } catch (error) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
          ? { ...current, error: error instanceof Error ? error.message : 'Unable to update cell.' }
          : current,
      );
    } finally {
      editableSubmitInFlightRef.current = false;
    }
  }, [editableCell, fieldById, onUpdateRecord]);

  const handleEditableCellBlur = useCallback(async () => {
    if (skipEditableBlurRef.current) {
      skipEditableBlurRef.current = false;
      return;
    }
    await submitEditableCell();
  }, [submitEditableCell]);

  const handleEditableCellKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        skipEditableBlurRef.current = true;
        try {
          await submitEditableCell();
        } finally {
          skipEditableBlurRef.current = false;
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        skipEditableBlurRef.current = true;
        setEditableCell(null);
      }
    },
    [submitEditableCell],
  );

  return {
    editableCell,
    setEditableCell,
    submitEditableCell,
    handleEditableCellBlur,
    handleEditableCellKeyDown,
  };
};
