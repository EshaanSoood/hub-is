import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSidebarNavigationState } from './useSidebarNavigationState';

interface SidebarNavigationHookProps {
  activeSpaceId: string | null;
  currentSpaceHref: string | null;
  isHomeState: boolean;
}

describe('useSidebarNavigationState', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to expanded home sections with no open project subtree in Home state', () => {
    const { result } = renderHook(() => useSidebarNavigationState({
      activeSpaceId: null,
      currentSpaceHref: null,
      isHomeState: true,
    }));

    expect(result.current.homeViewsExpanded).toBe(true);
    expect(result.current.projectsSectionExpanded).toBe(true);
    expect(result.current.roomsSectionExpanded).toBe(true);
    expect(result.current.expandedProjectId).toBeNull();
  });

  it('switches to the active space accordion when entering a space route', () => {
    const initialProps: SidebarNavigationHookProps = {
      activeSpaceId: null,
      currentSpaceHref: null,
      isHomeState: true,
    };

    const { result, rerender } = renderHook<ReturnType<typeof useSidebarNavigationState>, SidebarNavigationHookProps>(
      ({ activeSpaceId, currentSpaceHref, isHomeState }: SidebarNavigationHookProps) =>
        useSidebarNavigationState({ activeSpaceId, currentSpaceHref, isHomeState }),
      {
        initialProps,
      },
    );

    rerender({
      activeSpaceId: 'space-1',
      currentSpaceHref: '/projects/space-1/work/pane-1',
      isHomeState: false,
    });

    expect(result.current.homeViewsExpanded).toBe(false);
    expect(result.current.projectsSectionExpanded).toBe(true);
    expect(result.current.roomsSectionExpanded).toBe(false);
    expect(result.current.expandedProjectId).toBe('space-1');
    expect(result.current.projectRoutesBySpaceId['space-1']).toBe('/projects/space-1/work/pane-1');
  });

  it('remembers routes per space and resets Home state defaults when returning home', () => {
    const initialProps: SidebarNavigationHookProps = {
      activeSpaceId: 'space-1',
      currentSpaceHref: '/rooms/room-1/projects/pane-1',
      isHomeState: false,
    };

    const { result, rerender } = renderHook<ReturnType<typeof useSidebarNavigationState>, SidebarNavigationHookProps>(
      ({ activeSpaceId, currentSpaceHref, isHomeState }: SidebarNavigationHookProps) =>
        useSidebarNavigationState({ activeSpaceId, currentSpaceHref, isHomeState }),
      {
        initialProps,
      },
    );

    expect(result.current.projectRoutesBySpaceId['space-1']).toBe('/rooms/room-1/projects/pane-1');

    act(() => {
      result.current.setHomeViewsExpanded(true);
      result.current.setRoomsSectionExpanded(true);
      result.current.setExpandedProjectId('space-2');
    });

    rerender({
      activeSpaceId: null,
      currentSpaceHref: null,
      isHomeState: true,
    });

    expect(result.current.homeViewsExpanded).toBe(true);
    expect(result.current.roomsSectionExpanded).toBe(true);
    expect(result.current.expandedProjectId).toBeNull();
    expect(result.current.projectRoutesBySpaceId['space-1']).toBe('/rooms/room-1/projects/pane-1');
  });
});
