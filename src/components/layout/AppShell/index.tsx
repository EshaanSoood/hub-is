import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { useProjects } from '../../../context/ProjectsContext';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { LiveRegion } from '../../primitives';
import { fadeThroughVariants, routeFadeVariants, sharedAxisXVariants } from '../../motion/hubMotion';
import { decideRouteTransition } from './routeMotion';
import { BottomToolbar } from '../BottomToolbar';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [captureAnnouncement, setCaptureAnnouncement] = useState('');
  const location = useLocation();
  const navigationType = useNavigationType();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { projects } = useProjects();
  const previousRouteRef = useRef<{ pathname: string; state: unknown } | null>(null);
  const [transitionDecision, setTransitionDecision] = useState(() => decideRouteTransition({
    currentPathname: location.pathname,
    currentState: location.state,
    previousPathname: null,
    previousState: null,
    navigationType,
    getProjectName: (projectId) => projects.find((project) => project.id === projectId)?.name || null,
  }));

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransitionDecision(decideRouteTransition({
      currentPathname: location.pathname,
      currentState: location.state,
      previousPathname: previousRouteRef.current?.pathname ?? null,
      previousState: previousRouteRef.current?.state,
      navigationType,
      getProjectName: (projectId) => projects.find((project) => project.id === projectId)?.name || null,
    }));
    previousRouteRef.current = {
      pathname: location.pathname,
      state: location.state,
    };
  }, [location.pathname, location.state, navigationType, projects]);

  useRouteFocusReset();

  const routeTransitionVariants = transitionDecision.animation === 'shared-axis-x'
    ? sharedAxisXVariants(transitionDecision.paneDirection, prefersReducedMotion)
    : transitionDecision.animation === 'fade-through'
      ? fadeThroughVariants(prefersReducedMotion)
      : routeFadeVariants(prefersReducedMotion);

  const routeTransitionKey = location.pathname;

  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <header className="sr-only">
        <h1>Hub workspace</h1>
      </header>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <main id="main-content" className="flex-1 overflow-y-auto">
        <LayoutGroup id="hub-route-layout">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={routeTransitionKey}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={routeTransitionVariants}
              className="mx-auto w-full max-w-7xl px-4 py-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      </main>

      <BottomToolbar setCaptureAnnouncement={setCaptureAnnouncement} />

      <LiveRegion message={transitionDecision.announcement} role="status" ariaLive="polite" />
      <LiveRegion message={captureAnnouncement} ariaLive="polite" />
    </div>
  );
};
