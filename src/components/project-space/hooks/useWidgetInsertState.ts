import { useCallback, useEffect, useState } from 'react';
import type { WidgetInsertItemType } from '../widgetContracts';

export interface WidgetInsertPayload {
  id: string;
  type: string;
  title: string;
}

interface UseWidgetInsertStateOptions {
  onInsertToEditor?: (item: WidgetInsertPayload) => void;
}

export interface WidgetInsertState {
  activeItemId: string | null;
  activeItemType: WidgetInsertItemType;
  activeItemTitle: string | null;
  setActiveItem: (id: string, type: WidgetInsertItemType, title: string) => void;
  clearActiveItem: () => void;
  onInsertToEditor?: (item: WidgetInsertPayload) => void;
}

export const useWidgetInsertState = ({
  onInsertToEditor,
}: UseWidgetInsertStateOptions = {}): WidgetInsertState => {
  const insertEnabled = Boolean(onInsertToEditor);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<WidgetInsertItemType>(null);
  const [activeItemTitle, setActiveItemTitle] = useState<string | null>(null);

  const setActiveItem = useCallback((id: string, type: WidgetInsertItemType, title: string) => {
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
      if (target?.closest('[data-widget-insert-ignore="true"]')) {
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
