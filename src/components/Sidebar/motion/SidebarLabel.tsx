import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../../lib/cn';
import { sidebarLabelVariants } from './sidebarMotion';

interface SidebarLabelProps {
  children: ReactNode;
  className?: string;
  show: boolean;
}

export const SidebarLabel = ({
  children,
  className,
  show,
}: SidebarLabelProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={false}
      animate={show ? 'visible' : 'hidden'}
      variants={sidebarLabelVariants(prefersReducedMotion)}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};
