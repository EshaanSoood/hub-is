import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ModuleInsertItemType = 'task' | 'record' | 'file' | 'reminder' | 'quick-thought' | null;

interface ModuleInsertContextValue {
  activeItemId: string | null;
  activeItemType: ModuleInsertItemType;
  activeItemTitle: string | null;
  setActiveItem: (id: string, type: ModuleInsertItemType, title: string) => void;
  clearActiveItem: () => void;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}

const DEFAULT_CONTEXT: ModuleInsertContextValue = {
  activeItemId: null,
  activeItemType: null,
  activeItemTitle: null,
  setActiveItem: () => undefined,
  clearActiveItem: () => undefined,
  onInsertToEditor: undefined,
};

const ModuleInsertContext = createContext<ModuleInsertContextValue>(DEFAULT_CONTEXT);

export const ModuleInsertProvider = ({
  children,
  onInsertToEditor,
}: {
  children: ReactNode;
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
}) => {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItemType, setActiveItemType] = useState<ModuleInsertItemType>(null);
  const [activeItemTitle, setActiveItemTitle] = useState<string | null>(null);

  const setActiveItem = useCallback((id: string, type: ModuleInsertItemType, title: string) => {
    setActiveItemId(id);
    setActiveItemType(type);
    setActiveItemTitle(title);
  }, []);

  const clearActiveItem = useCallback(() => {
    setActiveItemId(null);
    setActiveItemType(null);
    setActiveItemTitle(null);
  }, []);

  useEffect(() => {
    if (!activeItemId) {
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
  }, [activeItemId, clearActiveItem]);

  const value = useMemo<ModuleInsertContextValue>(
    () => ({
      activeItemId,
      activeItemType,
      activeItemTitle,
      setActiveItem,
      clearActiveItem,
      onInsertToEditor,
    }),
    [activeItemId, activeItemTitle, activeItemType, clearActiveItem, onInsertToEditor, setActiveItem],
  );

  return <ModuleInsertContext.Provider value={value}>{children}</ModuleInsertContext.Provider>;
};

export const useModuleInsertContext = (): ModuleInsertContextValue => {
  return useContext(ModuleInsertContext);
};
