import { motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { classifyIntent } from '../../../lib/nlp/intent';
import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { SidebarLabel } from '../motion/SidebarLabel';
import {
  sidebarCaptureFocusVariants,
  sidebarMotionLayoutIds,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import {
  type CaptureDestination,
  type CaptureKind,
  type SidebarCaptureSurface,
  captureKindBySidebarSurface,
  moduleTypesByCaptureKind,
  readPaneHasModuleType,
} from './shared';

const CaptureDialog = lazy(async () => {
  const module = await import('./CaptureDialog');
  return { default: module.CaptureDialog };
});

interface CaptureInputProps {
  accessToken: string | null | undefined;
  autoFocusKey: number;
  currentProject: ProjectRecord | null;
  currentProjectPanes: HubPaneSummary[];
  currentSurface: SidebarCaptureSurface;
  currentSurfaceLabel: string | null;
  isCollapsed: boolean;
  onOpenCapture: () => void;
  personalProject: ProjectRecord | null;
  showLabels: boolean;
}

const resolveCaptureKind = (draft: string, currentSurface: SidebarCaptureSurface): CaptureKind => {
  if (currentSurface) {
    return captureKindBySidebarSurface[currentSurface];
  }
  const intent = classifyIntent(draft);
  if (intent.intent === 'task') {
    return 'task';
  }
  if (intent.intent === 'event') {
    return 'event';
  }
  if (intent.intent === 'reminder') {
    return 'reminder';
  }
  return 'thought';
};

export const CaptureInput = ({
  accessToken,
  autoFocusKey,
  currentProject,
  currentProjectPanes,
  currentSurface,
  currentSurfaceLabel,
  isCollapsed,
  onOpenCapture,
  personalProject,
  showLabels,
}: CaptureInputProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [draft, setDraft] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>('thought');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const paneDestination = useMemo<CaptureDestination | null>(() => {
    if (!currentProject) {
      return null;
    }
    const matchingPane = currentProjectPanes.find((pane) => readPaneHasModuleType(pane, moduleTypesByCaptureKind[captureKind])) || null;
    if (!matchingPane) {
      return null;
    }
    return {
      kind: 'pane',
      label: `${currentProject.name} / ${matchingPane.name}`,
      pane: matchingPane,
      project: currentProject,
    };
  }, [captureKind, currentProject, currentProjectPanes]);

  const destinations = useMemo<CaptureDestination[]>(
    () => [
      { kind: 'hub', label: 'myHub', project: personalProject, pane: null },
      ...(paneDestination ? [paneDestination] : []),
    ],
    [paneDestination, personalProject],
  );

  useEffect(() => {
    if (autoFocusKey > 0) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [autoFocusKey]);

  const openDialog = () => {
    if (!draft.trim()) {
      inputRef.current?.focus();
      return;
    }
    setCaptureKind(resolveCaptureKind(draft, currentSurface));
    setDialogOpen(true);
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open capture"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenCapture}
      >
        <Icon name="edit" size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.div
        initial={false}
        animate={isFocused || dialogOpen ? 'focused' : 'rest'}
        variants={sidebarCaptureFocusVariants(prefersReducedMotion)}
        className="relative rounded-panel border border-subtle bg-surface px-3 py-2"
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => {
          requestAnimationFrame(() => {
            setIsFocused(containerRef.current?.contains(document.activeElement) ?? false);
          });
        }}
      >
        {!dialogOpen ? (
          <motion.div
            aria-hidden="true"
            layoutId={prefersReducedMotion ? undefined : sidebarMotionLayoutIds.captureSurface}
            className="pointer-events-none absolute inset-0 rounded-panel border border-subtle bg-surface"
          />
        ) : null}
        <div className="relative z-[1] flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle bg-elevated text-text-secondary"
          >
            <Icon name="edit" size={16} />
          </span>
          <SidebarLabel show={showLabels} className="min-w-0 flex flex-1 items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  openDialog();
                }
              }}
              placeholder={currentSurfaceLabel ? `Capture for ${currentSurfaceLabel.toLowerCase()}…` : 'Capture anything…'}
              className="h-8 min-w-0 flex-1 border-0 bg-transparent text-sm leading-none text-text outline-none placeholder:text-text-secondary"
            />
            <button
              ref={triggerRef}
              type="button"
              aria-label="Open capture confirmation"
              className="interactive interactive-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle bg-elevated text-text-secondary hover:bg-surface-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={openDialog}
            >
              <Icon name="plus" size={14} />
            </button>
          </SidebarLabel>
        </div>
      </motion.div>

      {dialogOpen && !isCollapsed ? (
        <Suspense fallback={null}>
          <CaptureDialog
            accessToken={accessToken}
            captureKind={captureKind}
            containerRef={containerRef}
            destinations={destinations}
            draft={draft}
            open
            personalProject={personalProject}
            setDraft={setDraft}
            triggerRef={triggerRef}
            onClose={() => setDialogOpen(false)}
            onSaved={() => {
              setDraft('');
              setDialogOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
};
