import type { NavigationType } from 'react-router-dom';
import type { MotionDirection } from '../../../styles/motion';
import { motionDirection } from '../../../styles/motion';
import type { ProjectLateralSource } from '../../motion/hubMotion';
import { projectDirectionFromSource } from '../../motion/hubMotion';
import type { HubMotionState } from '../../../lib/hubMotionState';

export interface HubRouteDescriptor {
  pathname: string;
  layer: 'myhub' | 'project' | 'work-project' | 'other';
  rank: 0 | 1 | 2 | 3;
  projectId: string | null;
  workProjectId: string | null;
}

export interface RouteTransitionDecision {
  isBack: boolean;
  animation: 'fade' | 'fade-through' | 'shared-axis-x';
  projectSource: ProjectLateralSource;
  projectDirection: MotionDirection;
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
      workProjectId: null,
      projectId: null,
    };
  }

  const workProjectMatch = pathname.match(/^\/projects\/([^/]+)\/work\/([^/]+)$/);
  if (workProjectMatch) {
    return {
      pathname,
      layer: 'work-project',
      rank: 2,
      projectId: decodeSegment(workProjectMatch[1]),
      workProjectId: decodeSegment(workProjectMatch[2]),
    };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/(overview|work)$/);
  if (projectMatch) {
    return {
      pathname,
      layer: 'project',
      rank: 1,
      projectId: decodeSegment(projectMatch[1]),
      workProjectId: null,
    };
  }

  return {
    pathname,
    layer: 'other',
    rank: 3,
    workProjectId: null,
    projectId: null,
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
    hubProjectSource:
      state.hubProjectSource === 'click'
      || state.hubProjectSource === 'digit'
      || state.hubProjectSource === 'arrow-left'
      || state.hubProjectSource === 'arrow-right'
        ? state.hubProjectSource
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

const reverseProjectSource = (source: ProjectLateralSource): ProjectLateralSource => {
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
  return state.hubProjectName || getProjectName(descriptor.projectId) || 'Space';
};

const resolveWorkProjectName = (descriptor: HubRouteDescriptor, state: HubMotionState): string =>
  state.hubProjectName || descriptor.workProjectId || 'Project';

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
      projectSource: 'click',
      projectDirection: motionDirection.none,
      announcement: currentMotionState.hubAnnouncement || '',
      descriptor,
    };
  }

  const previousDescriptor = parseHubRouteDescriptor(previousPathname);
  const previousMotionState = readLocationMotionState(previousState);

  const shallowerHierarchyPush = navigationType === 'PUSH' && descriptor.rank < previousDescriptor.rank;
  const prefixBackPush = navigationType === 'PUSH' && isPathPrefix(currentPathname, previousPathname);
  const isBack = navigationType === 'POP' || shallowerHierarchyPush || prefixBackPush;

  let projectSource: ProjectLateralSource = currentMotionState.hubProjectSource || 'click';
  if (isBack && previousMotionState.hubProjectSource) {
    projectSource = reverseProjectSource(previousMotionState.hubProjectSource);
  }

  let announcement = currentMotionState.hubAnnouncement || '';

  const isMyHubToProject = previousDescriptor.layer === 'myhub' && descriptor.layer === 'project';
  const isProjectToWorkProject =
    previousDescriptor.layer === 'project'
    && descriptor.layer === 'work-project';
  const isWorkProjectToWorkProject =
    previousDescriptor.layer === 'work-project'
    && descriptor.layer === 'work-project'
    && previousDescriptor.projectId === descriptor.projectId
    && previousDescriptor.workProjectId !== descriptor.workProjectId;
  const isProjectToMyHubBack = previousDescriptor.layer === 'project' && descriptor.layer === 'myhub' && isBack;
  const isWorkProjectToProjectBack = previousDescriptor.layer === 'work-project' && descriptor.layer === 'project' && isBack;

  if (!announcement) {
    if (isMyHubToProject) {
      announcement = `Entered ${resolveProjectName(descriptor, currentMotionState, getProjectName)}`;
    } else if (isProjectToWorkProject) {
      announcement = `Opened ${resolveWorkProjectName(descriptor, currentMotionState)}`;
    } else if (isWorkProjectToWorkProject) {
      announcement = `Switched to ${resolveWorkProjectName(descriptor, currentMotionState)}`;
    } else if (isProjectToMyHubBack) {
      announcement = 'Back to Home';
    } else if (isWorkProjectToProjectBack) {
      announcement = `Back to ${resolveProjectName(descriptor, currentMotionState, getProjectName)}`;
    }
  }

  const projectDirection = projectDirectionFromSource(projectSource);
  const animation = isWorkProjectToWorkProject
    ? projectDirection === motionDirection.none
      ? 'fade-through'
      : 'shared-axis-x'
    : 'fade';

  return {
    isBack,
    animation,
    projectSource,
    projectDirection,
    announcement,
    descriptor,
  };
};
