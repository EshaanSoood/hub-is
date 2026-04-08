import { useCallback, useEffect, useState } from 'react';
import type { ModuleInsertItemType } from '../moduleContracts';

export interface ModuleInsertPayload {
  id: string;
  type: string;
  title: string;
}

interface UseModuleInsertStateOptions {
  onInsertToEditor?: (item: ModuleInsertPayload) => void;
}

export interface ModuleInsertState {
  activeItemId: string | null;
  activeItemType: ModuleInsertItemType;
  activeItemTitle: string | null;
  setActiveItem: (id: string, type: ModuleInsertItemType, title: string) => void;
  clearActiveItem: () => void;
  onInsertToEditor?: (item: ModuleInsertPayload) => void;
}

export const useModuleInsertState = ({
  onInsertToEditor,
}: UseModuleInsertStateOptions = {}): ModuleInsertState => {
  const insertEnabled = Boolean(onInsertToEditor);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<ModuleInsertItemType>(null);
  const [activeItemTitle, setActiveItemTitle] = useState<string | null>(null);

  const setActiveItem = useCallback((id: string, type: ModuleInsertItemType, title: string) => {
    if (!insertEnabled) {
      return;
    }
    setActiveItemId(id);
    setActiveItemType(type);
    setActiveItemTitle(title);
  }, [insertEnabled]);

  const clearActiveItem = useCallback(() => {
    setActiveItemId(null);
    setActiveItemType(null);
    setActiveItemTitle(null);
  }, []);

  useEffect(() => {
    if (!insertEnabled || !activeItemId) {
      return;
    }

    const handleDocumentPress = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-module-insert-ignore="true"]')) {
        return;
      }
      clearActiveItem();
    };

    document.addEventListener('mousedown', handleDocumentPress);
    document.addEventListener('touchstart', handleDocumentPress, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleDocumentPress);
      document.removeEventListener('touchstart', handleDocumentPress);
    };
  }, [activeItemId, clearActiveItem, insertEnabled]);

  return {
    activeItemId: insertEnabled ? activeItemId : null,
    activeItemType: insertEnabled ? activeItemType : null,
    activeItemTitle: insertEnabled ? activeItemTitle : null,
    setActiveItem,
    clearActiveItem,
    onInsertToEditor,
  };
};
