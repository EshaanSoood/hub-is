import type { ComponentProps, ReactElement } from 'react';
import { ProjectSpaceInspectorOverlay } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceInspectorOverlay';
import { ProjectSpaceWorkSurface } from '../../pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface';

interface HomeWorkSurfaceProps {
  inspectorOverlayProps: ComponentProps<typeof ProjectSpaceInspectorOverlay>;
  workSurfaceProps: ComponentProps<typeof ProjectSpaceWorkSurface>;
}

export const HomeWorkSurface = ({
  inspectorOverlayProps,
  workSurfaceProps,
}: HomeWorkSurfaceProps): ReactElement => (
  <>
    <ProjectSpaceWorkSurface {...workSurfaceProps} />
    <ProjectSpaceInspectorOverlay {...inspectorOverlayProps} />
  </>
);
