import type { ProjectLateralSource } from '../components/motion/hubMotion';

export interface HubMotionState {
  hubAnnouncement?: string;
  hubProjectName?: string;
  hubProjectSource?: ProjectLateralSource;
}

export const withHubMotionState = (state: unknown, motion: HubMotionState): HubMotionState => {
  const existingState = state && typeof state === 'object' ? state as Record<string, unknown> : {};
  return {
    ...existingState,
    ...motion,
  };
};
