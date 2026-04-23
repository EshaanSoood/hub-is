import type { NavigationType } from 'react-router-dom';
import type { MotionDirection } from '../../../styles/motion';
import { motionDirection } from '../../../styles/motion';
import type { PaneLateralSource } from '../../motion/hubMotion';
import { paneDirectionFromSource } from '../../motion/hubMotion';
import type { HubMotionState } from '../../../lib/hubMotionState';

export interface HubRouteDescriptor {
  pathname: string;
  layer: 'myhub' | 'project' | 'pane' | 'other';
  rank: 0 | 1 | 2 | 3;
  projectId: string | null;
  paneId: string | null;
}

export interface RouteTransitionDecision {
  isBack: boolean;
  animation: 'fade' | 'fade-through' | 'shared-axis-x';
  paneSource: PaneLateralSource;
  paneDirection: MotionDirection;
  announcement: string;
  descriptor: HubRouteDescriptor;
}

const decodeSegment = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const parseHubRouteDescriptor = (pathname: string): HubRouteDescriptor => {
  if (pathname === '/projects') {
    return {
      pathname,
      layer: 'myhub',
      rank: 0,
      projectId: null,
      paneId: null,
    };
  }

  const paneMatch = pathname.match(/^\/projects\/([^/]+)\/work\/([^/]+)$/);
  if (paneMatch) {
    return {
      pathname,
      layer: 'pane',
      rank: 2,
      projectId: decodeSegment(paneMatch[1]),
      paneId: decodeSegment(paneMatch[2]),
    };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/(overview|work)$/);
  if (projectMatch) {
    return {
      pathname,
      layer: 'project',
      rank: 1,
      projectId: decodeSegment(projectMatch[1]),
      paneId: null,
    };
  }

  return {
    pathname,
    layer: 'other',
    rank: 3,
    projectId: null,
    paneId: null,
  };
};

const readLocationMotionState = (value: unknown): HubMotionState => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const state = value as Record<string, unknown>;
  return {
    hubAnnouncement: typeof state.hubAnnouncement === 'string' ? state.hubAnnouncement : undefined,
    hubProjectName: typeof state.hubProjectName === 'string' ? state.hubProjectName : undefined,
    hubPaneName: typeof state.hubPaneName === 'string' ? state.hubPaneName : undefined,
    hubPaneSource:
      state.hubPaneSource === 'click'
      || state.hubPaneSource === 'digit'
      || state.hubPaneSource === 'arrow-left'
      || state.hubPaneSource === 'arrow-right'
        ? state.hubPaneSource
        : undefined,
  };
};

const isPathPrefix = (shortPath: string, longPath: string): boolean => {
  if (shortPath === longPath) {
    return true;
  }
  const shortParts = shortPath.split('/').filter(Boolean);
  const longParts = longPath.split('/').filter(Boolean);
  if (shortParts.length >= longParts.length) {
    return false;
  }
  return shortParts.every((segment, index) => longParts[index] === segment);
};

const reversePaneSource = (source: PaneLateralSource): PaneLateralSource => {
  if (source === 'arrow-right') {
    return 'arrow-left';
  }
  if (source === 'arrow-left') {
    return 'arrow-right';
  }
  return source;
};

const resolveProjectName = (
  descriptor: HubRouteDescriptor,
  state: HubMotionState,
  getProjectName: (projectId: string | null) => string | null,
): string => {
  return state.hubProjectName || getProjectName(descriptor.projectId) || 'Project';
};

const resolvePaneName = (
  descriptor: HubRouteDescriptor,
  state: HubMotionState,
): string => {
  return state.hubPaneName || descriptor.paneId || 'Project';
};

export const decideRouteTransition = ({
  currentPathname,
  currentState,
  previousPathname,
  previousState,
  navigationType,
  getProjectName,
}: {
  currentPathname: string;
  currentState: unknown;
  previousPathname: string | null;
  previousState: unknown;
  navigationType: NavigationType;
  getProjectName: (projectId: string | null) => string | null;
}): RouteTransitionDecision => {
  const descriptor = parseHubRouteDescriptor(currentPathname);
  const currentMotionState = readLocationMotionState(currentState);

  if (!previousPathname) {
    return {
      isBack: false,
      animation: 'fade',
      paneSource: 'click',
      paneDirection: motionDirection.none,
      announcement: currentMotionState.hubAnnouncement || '',
      descriptor,
    };
  }

  const previousDescriptor = parseHubRouteDescriptor(previousPathname);
  const previousMotionState = readLocationMotionState(previousState);

  const shallowerHierarchyPush = navigationType === 'PUSH' && descriptor.rank < previousDescriptor.rank;
  const prefixBackPush = navigationType === 'PUSH' && isPathPrefix(currentPathname, previousPathname);
  const isBack = navigationType === 'POP' || shallowerHierarchyPush || prefixBackPush;

  let paneSource: PaneLateralSource = currentMotionState.hubPaneSource || 'click';
  if (isBack && previousMotionState.hubPaneSource) {
    paneSource = reversePaneSource(previousMotionState.hubPaneSource);
  }

  let announcement = currentMotionState.hubAnnouncement || '';

  const isMyHubToProject = previousDescriptor.layer === 'myhub' && descriptor.layer === 'project';
  const isProjectToPane = previousDescriptor.layer === 'project' && descriptor.layer === 'pane';
  const isPaneToPane =
    previousDescriptor.layer === 'pane'
    && descriptor.layer === 'pane'
    && previousDescriptor.projectId === descriptor.projectId
    && previousDescriptor.paneId !== descriptor.paneId;
  const isProjectToMyHubBack = previousDescriptor.layer === 'project' && descriptor.layer === 'myhub' && isBack;
  const isPaneToProjectBack = previousDescriptor.layer === 'pane' && descriptor.layer === 'project' && isBack;

  if (!announcement) {
    if (isMyHubToProject) {
      announcement = `Entered ${resolveProjectName(descriptor, currentMotionState, getProjectName)}`;
    } else if (isProjectToPane) {
      announcement = `Opened ${resolvePaneName(descriptor, currentMotionState)}`;
    } else if (isPaneToPane) {
      announcement = `Switched to ${resolvePaneName(descriptor, currentMotionState)}`;
    } else if (isProjectToMyHubBack) {
      announcement = 'Back to Home';
    } else if (isPaneToProjectBack) {
      announcement = `Back to ${resolveProjectName(descriptor, currentMotionState, getProjectName)}`;
    }
  }

  const paneDirection = paneDirectionFromSource(paneSource);
  const animation = isPaneToPane
    ? paneDirection === motionDirection.none
      ? 'fade-through'
      : 'shared-axis-x'
    : 'fade';

  return {
    isBack,
    animation,
    paneSource,
    paneDirection,
    announcement,
    descriptor,
  };
};
