import { useEffect } from 'react';
import { type NavigateFunction } from 'react-router-dom';
import { z } from 'zod';

const RouteStateSchema = z.object({
  focusNodeKey: z.string().optional(),
}).catchall(z.unknown());

const readFocusNodeKeyFromLocationState = (state: unknown): string | null => {
  const parsedState = RouteStateSchema.safeParse(state);
  if (!parsedState.success) {
    return null;
  }
  const focusNodeKey = parsedState.data.focusNodeKey;
  if (!focusNodeKey) {
    return null;
  }
  const trimmed = focusNodeKey.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFocusNodeKeyFromSearchParams = (params: URLSearchParams): string | null => {
  const value = params.get('focus_node_key');
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

interface UseFocusNodeQueryEffectParams {
  activeProjectDocId: string | null;
  locationPathname: string;
  locationState: unknown;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  setPendingDocFocusNodeKey: (nodeKey: string | null) => void;
}

export const useFocusNodeQueryEffect = ({
  activeProjectDocId,
  locationPathname,
  locationState,
  navigate,
  searchParams,
  setPendingDocFocusNodeKey,
}: UseFocusNodeQueryEffectParams): void => {
  useEffect(() => {
    if (!activeProjectDocId) {
      return;
    }
    const focusNodeKey = readFocusNodeKeyFromLocationState(locationState) || readFocusNodeKeyFromSearchParams(searchParams);
    if (!focusNodeKey) {
      return;
    }
    setPendingDocFocusNodeKey(focusNodeKey);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('focus_node_key');
    const query = nextParams.toString();
    navigate(query ? `${locationPathname}?${query}` : locationPathname, { replace: true, state: null });
  }, [activeProjectDocId, locationPathname, locationState, navigate, searchParams, setPendingDocFocusNodeKey]);
};
