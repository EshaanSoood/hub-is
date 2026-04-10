import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../../lib/cn';
import { sidebarMotionLayoutIds, sidebarSelectionMarkerTransition } from './sidebarMotion';

interface SidebarSelectionMarkerProps {
  className?: string;
}

export const SidebarSelectionMarker = ({ className }: SidebarSelectionMarkerProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.span
      aria-hidden="true"
      layoutId={prefersReducedMotion ? undefined : sidebarMotionLayoutIds.selectionMarker}
      transition={sidebarSelectionMarkerTransition}
      className={cn('pointer-events-none absolute inset-0 rounded-control border border-subtle bg-elevated', className)}
    />
  );
};
