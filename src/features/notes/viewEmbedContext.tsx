import { createContext, useContext } from 'react';

export interface ViewEmbedRuntime {
  accessToken: string;
  onOpenRecord?: (recordId: string) => void;
  onOpenView?: (viewId: string) => void;
}

const ViewEmbedContext = createContext<ViewEmbedRuntime | null>(null);

export const ViewEmbedProvider = ViewEmbedContext.Provider;

export const useViewEmbedRuntime = (): ViewEmbedRuntime | null => useContext(ViewEmbedContext);
