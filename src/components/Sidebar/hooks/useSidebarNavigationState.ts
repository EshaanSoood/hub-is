import { useCallback, useEffect, useMemo, useState } from 'react';

const SIDEBAR_SPACE_ROUTE_MEMORY_KEY = 'hub-sidebar-space-route-memory';
const MAX_STORED_SPACE_ROUTES = 32;

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

const pruneStoredProjectRoutes = (
  routesBySpaceId: Record<string, string>,
  knownSpaceIds: readonly string[],
): Record<string, string> => {
  const allowedSpaceIds = new Set(knownSpaceIds);
  const entries = Object.entries(routesBySpaceId).filter(([spaceId, href]) =>
    allowedSpaceIds.has(spaceId) && typeof href === 'string' && href.startsWith('/'));
  return Object.fromEntries(entries.slice(-MAX_STORED_SPACE_ROUTES));
};

const mergeStoredProjectRoute = (
  storedRoutesBySpaceId: Record<string, string>,
  activeSpaceId: string | null,
  currentSpaceHref: string | null,
  knownSpaceIds: readonly string[],
): Record<string, string> => {
  const prunedRoutesBySpaceId = pruneStoredProjectRoutes(storedRoutesBySpaceId, knownSpaceIds);
  if (!activeSpaceId || !currentSpaceHref) {
    return prunedRoutesBySpaceId;
  }

  const nextEntries = Object.entries(prunedRoutesBySpaceId).filter(([spaceId]) => spaceId !== activeSpaceId);
  nextEntries.push([activeSpaceId, currentSpaceHref]);
  return Object.fromEntries(nextEntries.slice(-MAX_STORED_SPACE_ROUTES));
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
  knownSpaceIds,
}: {
  activeSpaceId: string | null;
  currentSpaceHref: string | null;
  isHomeState: boolean;
  knownSpaceIds: readonly string[];
}): SidebarNavigationState => {
  const scopeKey = isHomeState ? 'home' : activeSpaceId ? `space:${activeSpaceId}` : 'other';
  const [homeViewsOverrides, setHomeViewsOverrides] = useState<Record<string, boolean>>({});
  const [projectsSectionOverrides, setProjectsSectionOverrides] = useState<Record<string, boolean>>({});
  const [roomsSectionOverrides, setRoomsSectionOverrides] = useState<Record<string, boolean>>({});
  const [expandedProjectOverrides, setExpandedProjectOverrides] = useState<Record<string, string | null>>({});

  const projectRoutesBySpaceId = useMemo(() => {
    return mergeStoredProjectRoute(readStoredProjectRoutes(), activeSpaceId, currentSpaceHref, knownSpaceIds);
  }, [activeSpaceId, currentSpaceHref, knownSpaceIds]);

  const defaultHomeViewsExpanded = isHomeState;
  const defaultProjectsSectionExpanded = true;
  const defaultRoomsSectionExpanded = isHomeState;
  const defaultExpandedProjectId = isHomeState ? null : activeSpaceId;

  const homeViewsExpanded = homeViewsOverrides[scopeKey] ?? defaultHomeViewsExpanded;
  const projectsSectionExpanded = projectsSectionOverrides[scopeKey] ?? defaultProjectsSectionExpanded;
  const roomsSectionExpanded = roomsSectionOverrides[scopeKey] ?? defaultRoomsSectionExpanded;
  const expandedProjectId = expandedProjectOverrides[scopeKey] ?? defaultExpandedProjectId;

  useEffect(() => {
    const stored = readStoredProjectRoutes();
    const nextRoutesBySpaceId = mergeStoredProjectRoute(stored, activeSpaceId, currentSpaceHref, knownSpaceIds);
    const storedJson = JSON.stringify(stored);
    const nextJson = JSON.stringify(nextRoutesBySpaceId);
    if (storedJson === nextJson) {
      return;
    }
    try {
      window.localStorage.setItem(
        SIDEBAR_SPACE_ROUTE_MEMORY_KEY,
        nextJson,
      );
    } catch {
      // Ignore storage failures so sidebar route memory remains non-blocking.
    }
  }, [activeSpaceId, currentSpaceHref, knownSpaceIds]);

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
