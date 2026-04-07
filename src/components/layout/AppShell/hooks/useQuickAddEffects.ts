import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { focusElementSoon, type QuickAddDialog } from '../../appShellUtils';

interface UseQuickAddEffectsArgs {
  contextMenuOpen: boolean;
  setQuickAddActiveIndex: Dispatch<SetStateAction<number>>;
  quickAddItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  quickAddDialog: QuickAddDialog;
  taskTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  eventTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  reminderInputRef: MutableRefObject<HTMLInputElement | null>;
  projectNameInputRef: MutableRefObject<HTMLInputElement | null>;
}

export const useQuickAddEffects = ({
  contextMenuOpen,
  setQuickAddActiveIndex,
  quickAddItemRefs,
  quickAddDialog,
  taskTitleInputRef,
  eventTitleInputRef,
  reminderInputRef,
  projectNameInputRef,
}: UseQuickAddEffectsArgs) => {
  useEffect(() => {
    if (!contextMenuOpen) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      setQuickAddActiveIndex(0);
      focusElementSoon(quickAddItemRefs.current[0]);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [contextMenuOpen]);

  useEffect(() => {
    if (quickAddDialog === 'task') {
      focusElementSoon(taskTitleInputRef.current);
      return;
    }
    if (quickAddDialog === 'event') {
      focusElementSoon(eventTitleInputRef.current);
      return;
    }
    if (quickAddDialog === 'reminder') {
      focusElementSoon(reminderInputRef.current);
      return;
    }
    if (quickAddDialog === 'project') {
      focusElementSoon(projectNameInputRef.current);
    }
  }, [quickAddDialog]);
};
