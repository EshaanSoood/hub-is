import type { TargetAndTransition, Transition, Variants } from 'framer-motion';
import { transitionReduced } from '../../motion/hubMotion';
import { motionDurations, motionEasings } from '../../../styles/motion';

export const sidebarMotionDurations = {
  labelFade: 0.06,
  shellResize: motionDurations.fade,
  shellExpandDelay: motionDurations.fade,
  accordion: motionDurations.fade,
  overlayEnter: 0.15,
  overlayExit: 0.1,
  captureFocus: 0.1,
  accordionItemStagger: 0.02,
  searchItemStagger: 0.015,
} as const;

export const sidebarMotionLayoutIds = {
  captureSurface: 'sidebar-capture-surface',
  selectionMarker: 'sidebar-selection-marker',
} as const;

const sidebarSpring: Transition = {
  type: 'spring',
  bounce: 0,
  visualDuration: sidebarMotionDurations.shellResize,
  stiffness: 420,
  damping: 36,
};

const accordionSpring: Transition = {
  type: 'spring',
  bounce: 0,
  visualDuration: sidebarMotionDurations.accordion,
  stiffness: 360,
  damping: 34,
};

export const sidebarSelectionMarkerTransition: Transition = {
  type: 'spring',
  bounce: 0,
  visualDuration: motionDurations.fade,
  stiffness: 420,
  damping: 40,
};

export const sidebarShellVariants = (reducedMotion: boolean): Record<'expanded' | 'collapsed', TargetAndTransition> => ({
  expanded: {
    width: 'var(--sidebar-width-expanded)',
    minWidth: 'var(--sidebar-width-expanded)',
    transition: reducedMotion ? transitionReduced : sidebarSpring,
  },
  collapsed: {
    width: 'var(--sidebar-width-collapsed)',
    minWidth: 'var(--sidebar-width-collapsed)',
    transition: reducedMotion ? transitionReduced : sidebarSpring,
  },
});

export const sidebarLabelVariants = (reducedMotion: boolean): Variants => ({
  visible: {
    opacity: 1,
    transition: reducedMotion
      ? transitionReduced
      : {
          duration: sidebarMotionDurations.labelFade,
          ease: motionEasings.fade,
        },
  },
  hidden: {
    opacity: 0,
    transition: reducedMotion
      ? transitionReduced
      : {
          duration: sidebarMotionDurations.labelFade,
          ease: motionEasings.fade,
        },
  },
});

export const sidebarAccordionContentVariants = (reducedMotion: boolean): Variants => ({
  collapsed: reducedMotion
    ? { opacity: 0 }
    : { height: 0, opacity: 0 },
  expanded: reducedMotion
    ? { opacity: 1, transition: transitionReduced }
    : {
        height: 'auto',
        opacity: 1,
        transition: accordionSpring,
      },
  exit: reducedMotion
    ? { opacity: 0, transition: transitionReduced }
    : {
        height: 0,
        opacity: 0,
        transition: accordionSpring,
      },
});

export const sidebarAccordionListVariants = (reducedMotion: boolean): Variants => ({
  expanded: {
    transition: {
      staggerChildren: reducedMotion ? 0 : sidebarMotionDurations.accordionItemStagger,
      delayChildren: reducedMotion ? 0 : sidebarMotionDurations.accordionItemStagger,
    },
  },
});

export const sidebarAccordionItemVariants = (reducedMotion: boolean): Variants => ({
  collapsed: {
    opacity: 0,
    y: reducedMotion ? 0 : -4,
  },
  expanded: {
    opacity: 1,
    y: 0,
    transition: reducedMotion ? transitionReduced : accordionSpring,
  },
});

export const sidebarChevronVariants = (reducedMotion: boolean): Variants => ({
  collapsed: {
    rotate: -90,
    transition: reducedMotion ? transitionReduced : accordionSpring,
  },
  expanded: {
    rotate: 0,
    transition: reducedMotion ? transitionReduced : accordionSpring,
  },
});

export const sidebarCaptureFocusVariants = (reducedMotion: boolean): Variants => ({
  rest: {
    scale: 1,
    boxShadow: 'none',
    transition: reducedMotion
      ? transitionReduced
      : {
          type: 'spring',
          bounce: 0,
          visualDuration: sidebarMotionDurations.captureFocus,
          stiffness: 420,
          damping: 38,
        },
  },
  focused: {
    scale: reducedMotion ? 1 : 1.02,
    boxShadow: 'var(--shadow-soft)',
    transition: reducedMotion
      ? transitionReduced
      : {
          type: 'spring',
          bounce: 0,
          visualDuration: sidebarMotionDurations.captureFocus,
          stiffness: 420,
          damping: 38,
        },
  },
});

export const sidebarSearchOverlayVariants = (reducedMotion: boolean): Variants => ({
  initial: reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: reducedMotion
      ? transitionReduced
      : {
          duration: sidebarMotionDurations.overlayEnter,
          ease: motionEasings.fade,
        },
  },
  exit: {
    opacity: 0,
    scale: reducedMotion ? 1 : 0.99,
    transition: reducedMotion
      ? transitionReduced
      : {
          duration: sidebarMotionDurations.overlayExit,
          ease: motionEasings.fade,
        },
  },
});

export const sidebarSearchResultsVariants = (reducedMotion: boolean): Variants => ({
  animate: {
    transition: {
      staggerChildren: reducedMotion ? 0 : sidebarMotionDurations.searchItemStagger,
      delayChildren: reducedMotion ? 0 : sidebarMotionDurations.searchItemStagger,
    },
  },
});

export const sidebarSearchResultVariants = (reducedMotion: boolean): Variants => ({
  initial: {
    opacity: 0,
    y: reducedMotion ? 0 : 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: reducedMotion ? transitionReduced : accordionSpring,
  },
  exit: {
    opacity: 0,
    y: reducedMotion ? 0 : -2,
    transition: reducedMotion ? transitionReduced : transitionReduced,
  },
});
