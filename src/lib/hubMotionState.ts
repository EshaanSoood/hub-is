import type { PaneLateralSource } from '../components/motion/hubMotion';

export interface HubMotionState {
  hubAnnouncement?: string;
  hubProjectName?: string;
  hubPaneName?: string;
  hubPaneSource?: PaneLateralSource;
}

export const withHubMotionState = (state: unknown, motion: HubMotionState): HubMotionState => {
  const existingState = state && typeof state === 'object' ? state as Record<string, unknown> : {};
  return {
    ...existingState,
    ...motion,
  };
};
