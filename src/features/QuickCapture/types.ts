import type { HubHomeCapture } from '../../services/hub/types';
import type { ProjectRecord } from '../../types/domain';

export type CaptureMode = 'thought' | 'task' | 'reminder' | 'calendar';

export type CaptureSortDirection = 'desc' | 'asc';

export interface ExpandedCaptureAssignment {
  recordId: string;
  mode: CaptureMode;
  projectId: string;
}

export interface QuickCapturePanelProps {
  accessToken: string | null;
  projects: ProjectRecord[];
  personalProjectId: string | null;
  captures: HubHomeCapture[];
  capturesLoading?: boolean;
  onCaptureComplete: () => void | Promise<void>;
  preferredProjectId?: string | null;
  initialIntent?: string | null;
  activationKey?: number;
  onRequestClose: (options?: { restoreFocus?: boolean }) => void;
}
