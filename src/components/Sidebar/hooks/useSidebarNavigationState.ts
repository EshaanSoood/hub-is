import { useCallback, useEffect, useMemo, useState } from 'react';

const SIDEBAR_SPACE_ROUTE_MEMORY_KEY = 'hub-sidebar-space-route-memory';

export interface SidebarNavigationState {
  expandedProjectId: string | null;
  homeViewsExpanded: boolean;
  projectRoutesBySpaceId: Record<string, string>;
  projectsSectionExpanded: boolean;
  roomsSectionExpanded: boolean;
  setExpandedProjectId: (value: string | null | ((current: string | null) => string | null)) => void;
  setHomeViewsExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
  setProjectsSectionExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
  setRoomsSectionExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
}

const readStoredProjectRoutes = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_SPACE_ROUTE_MEMORY_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[0].trim().length > 0 && entry[1].startsWith('/'),
      ),
    );
  } catch {
    return {};
  }
};

const resolveBooleanUpdate = (
  value: boolean | ((current: boolean) => boolean),
  current: boolean,
): boolean => (typeof value === 'function' ? value(current) : value);

const resolveNullableStringUpdate = (
  value: string | null | ((current: string | null) => string | null),
  current: string | null,
): string | null => (typeof value === 'function' ? value(current) : value);

export const useSidebarNavigationState = ({
  activeSpaceId,
  currentSpaceHref,
  isHomeState,
}: {
  activeSpaceId: string | null;
  currentSpaceHref: string | null;
  isHomeState: boolean;
}): SidebarNavigationState => {
  const scopeKey = isHomeState ? 'home' : activeSpaceId ? `space:${activeSpaceId}` : 'other';
  const [homeViewsOverrides, setHomeViewsOverrides] = useState<Record<string, boolean>>({});
  const [projectsSectionOverrides, setProjectsSectionOverrides] = useState<Record<string, boolean>>({});
  const [roomsSectionOverrides, setRoomsSectionOverrides] = useState<Record<string, boolean>>({});
  const [expandedProjectOverrides, setExpandedProjectOverrides] = useState<Record<string, string | null>>({});

  const projectRoutesBySpaceId = useMemo(() => {
    const stored = readStoredProjectRoutes();
    if (!activeSpaceId || !currentSpaceHref) {
      return stored;
    }
    return {
      ...stored,
      [activeSpaceId]: currentSpaceHref,
    };
  }, [activeSpaceId, currentSpaceHref]);

  const defaultHomeViewsExpanded = isHomeState;
  const defaultProjectsSectionExpanded = true;
  const defaultRoomsSectionExpanded = isHomeState;
  const defaultExpandedProjectId = isHomeState ? null : activeSpaceId;

  const homeViewsExpanded = homeViewsOverrides[scopeKey] ?? defaultHomeViewsExpanded;
  const projectsSectionExpanded = projectsSectionOverrides[scopeKey] ?? defaultProjectsSectionExpanded;
  const roomsSectionExpanded = roomsSectionOverrides[scopeKey] ?? defaultRoomsSectionExpanded;
  const expandedProjectId = expandedProjectOverrides[scopeKey] ?? defaultExpandedProjectId;

  useEffect(() => {
    if (!activeSpaceId || !currentSpaceHref) {
      return;
    }
    const stored = readStoredProjectRoutes();
    if (stored[activeSpaceId] === currentSpaceHref) {
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_SPACE_ROUTE_MEMORY_KEY,
      JSON.stringify({
        ...stored,
        [activeSpaceId]: currentSpaceHref,
      }),
    );
  }, [activeSpaceId, currentSpaceHref]);

  const setHomeViewsExpanded = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    setHomeViewsOverrides((current) => ({
      ...current,
      [scopeKey]: resolveBooleanUpdate(value, current[scopeKey] ?? defaultHomeViewsExpanded),
    }));
  }, [defaultHomeViewsExpanded, scopeKey]);

  const setProjectsSectionExpanded = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    setProjectsSectionOverrides((current) => ({
      ...current,
      [scopeKey]: resolveBooleanUpdate(value, current[scopeKey] ?? defaultProjectsSectionExpanded),
    }));
  }, [defaultProjectsSectionExpanded, scopeKey]);

  const setRoomsSectionExpanded = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    setRoomsSectionOverrides((current) => ({
      ...current,
      [scopeKey]: resolveBooleanUpdate(value, current[scopeKey] ?? defaultRoomsSectionExpanded),
    }));
  }, [defaultRoomsSectionExpanded, scopeKey]);

  const setExpandedProjectId = useCallback((value: string | null | ((current: string | null) => string | null)) => {
    setExpandedProjectOverrides((current) => ({
      ...current,
      [scopeKey]: resolveNullableStringUpdate(value, current[scopeKey] ?? defaultExpandedProjectId),
    }));
  }, [defaultExpandedProjectId, scopeKey]);

  return {
    expandedProjectId,
    homeViewsExpanded,
    projectRoutesBySpaceId,
    projectsSectionExpanded,
    roomsSectionExpanded,
    setExpandedProjectId,
    setHomeViewsExpanded,
    setProjectsSectionExpanded,
    setRoomsSectionExpanded,
  };
};
