import type { Transition, Variants } from 'framer-motion';
import { motionDirection, motionDistances, motionDurations, motionEasings, type MotionDirection } from '../../styles/motion';

export type PaneLateralSource = 'click' | 'digit' | 'arrow-left' | 'arrow-right';

export const transitionEnter: Transition = {
  duration: motionDurations.enter,
  ease: motionEasings.enter,
};

export const transitionExit: Transition = {
  duration: motionDurations.exit,
  ease: motionEasings.exit,
};

export const transitionLateral: Transition = {
  duration: motionDurations.lateral,
  ease: motionEasings.lateral,
};

export const transitionFade: Transition = {
  duration: motionDurations.fade,
  ease: motionEasings.fade,
};

export const transitionReduced: Transition = {
  duration: motionDurations.reduced,
  ease: motionEasings.fade,
};

export const popoverVariants = (reducedMotion: boolean): Variants => ({
  initial: reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: motionDistances.popoverScaleStart },
  animate: { opacity: 1, scale: 1, transition: reducedMotion ? transitionReduced : transitionFade },
  exit: reducedMotion
    ? { opacity: 0, transition: transitionReduced }
    : { opacity: 0, scale: motionDistances.popoverScaleStart, transition: transitionFade },
});

export const dialogSurfaceVariants = (reducedMotion: boolean): Variants => ({
  initial: reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: motionDistances.depthEnter, scale: motionDistances.fadeThroughScaleStart },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: reducedMotion ? transitionReduced : transitionEnter,
  },
  exit: reducedMotion
    ? { opacity: 0, transition: transitionReduced }
    : {
        opacity: 0,
        y: -motionDistances.depthExit,
        scale: motionDistances.fadeThroughScaleStart,
        transition: transitionExit,
      },
});

export const routeFadeVariants = (reducedMotion: boolean): Variants => ({
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: reducedMotion ? transitionReduced : transitionFade },
  exit: { opacity: 0, transition: reducedMotion ? transitionReduced : transitionFade },
});

const sharedAxisOffsetForDirection = (direction: MotionDirection, reducedMotion: boolean): number => {
  const baseOffset = reducedMotion ? motionDistances.reducedOffset : motionDistances.lateralOffset;
  return direction * baseOffset;
};

export const sharedAxisXVariants = (direction: MotionDirection, reducedMotion: boolean): Variants => ({
  initial: {
    opacity: 0,
    x: sharedAxisOffsetForDirection(direction, reducedMotion),
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: reducedMotion ? transitionReduced : transitionLateral,
  },
  exit: {
    opacity: 0,
    x: sharedAxisOffsetForDirection(
      direction === motionDirection.none
        ? motionDirection.none
        : direction === motionDirection.right
          ? motionDirection.left
          : motionDirection.right,
      reducedMotion,
    ),
    transition: reducedMotion ? transitionReduced : transitionLateral,
  },
});

export const fadeThroughVariants = (reducedMotion: boolean): Variants => ({
  initial: { opacity: 0, scale: motionDistances.fadeThroughScaleStart },
  animate: {
    opacity: 1,
    scale: 1,
    transition: reducedMotion ? transitionReduced : transitionFade,
  },
  exit: {
    opacity: 0,
    scale: motionDistances.fadeThroughScaleStart,
    transition: reducedMotion ? transitionReduced : transitionFade,
  },
});

export const paneDirectionFromSource = (source: PaneLateralSource): MotionDirection => {
  if (source === 'arrow-right') {
    return motionDirection.right;
  }
  if (source === 'arrow-left') {
    return motionDirection.left;
  }
  return motionDirection.none;
};
