import { useReducedMotion } from 'framer-motion';
import { HomeWorkSurface } from './HomeWorkSurface';
import { useHomeProjectWorkRuntime } from './useHomeProjectWorkRuntime';

type HomeProjectWorkSectionProps = Omit<Parameters<typeof useHomeProjectWorkRuntime>[0], 'prefersReducedMotion'>;

export const HomeProjectWorkSection = (props: HomeProjectWorkSectionProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const runtime = useHomeProjectWorkRuntime({
    ...props,
    prefersReducedMotion,
  });

  return (
    <HomeWorkSurface
      inspectorOverlayProps={runtime.inspectorOverlayProps}
      workSurfaceProps={runtime.workSurfaceProps}
    />
  );
};
