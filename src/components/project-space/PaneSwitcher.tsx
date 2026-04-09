import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import type { PaneLateralSource } from '../motion/hubMotion';

export interface PaneSwitcherPane {
  id: string;
  label: string;
  shortcutNumber?: number;
  disabled?: boolean;
}

interface PaneSwitcherProps {
  id?: string;
  panes: PaneSwitcherPane[];
  activePaneId: string | null;
  onPaneChange: (paneId: string, source: PaneLateralSource) => void;
  onMovePane?: (paneId: string, direction: 'up' | 'down') => void;
}

export const PaneSwitcher = ({ id, panes, activePaneId, onPaneChange, onMovePane }: PaneSwitcherProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredPaneId, setHoveredPaneId] = useState<string | null>(null);
  const paneRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const paneByShortcut = useMemo(() => {
    const map = new Map<number, PaneSwitcherPane>();
    for (const pane of panes) {
      if (pane.shortcutNumber) {
        map.set(pane.shortcutNumber, pane);
      }
    }
    return map;
  }, [panes]);

  const focusByIndex = (index: number) => {
    if (panes.length === 0) {
      return;
    }
    const clamped = (index + panes.length) % panes.length;
    paneRefs.current[clamped]?.focus();
  };

  if (panes.length === 0) {
    return <p className="text-xs text-muted">No panes available.</p>;
  }

  return (
    <div id={id} role="toolbar" aria-label="Open panes" className="flex items-center gap-0.5 px-2 py-1">
      <span className="sr-only">
        Use Left and Right arrows to navigate between panes. Use Home and End to move focus to first and last panes. Use Ctrl plus arrows to reorder panes.
      </span>
      {panes.map((pane, index) => {
        const isActive = pane.id === activePaneId;
        const isHovered = hoveredPaneId === pane.id;
        const revealLabel = isHovered || isActive;

        return (
          <motion.button
            key={pane.id}
            layoutId={!prefersReducedMotion ? `pane-${pane.id}` : undefined}
            ref={(node) => {
              paneRefs.current[index] = node;
            }}
            type="button"
            aria-pressed={isActive}
            aria-label={`${pane.label}${pane.shortcutNumber ? `, pane ${pane.shortcutNumber}` : ''}`}
            disabled={pane.disabled}
            onClick={() => onPaneChange(pane.id, 'click')}
            aria-keyshortcuts={onMovePane ? 'Control+ArrowLeft Control+ArrowRight' : undefined}
            onMouseEnter={() => setHoveredPaneId(pane.id)}
            onMouseLeave={() => setHoveredPaneId((current) => (current === pane.id ? null : current))}
            onFocus={() => setHoveredPaneId(pane.id)}
            onBlur={() => setHoveredPaneId((current) => (current === pane.id ? null : current))}
            onKeyDown={(event) => {
              if (event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && onMovePane) {
                event.preventDefault();
                onMovePane(pane.id, event.key === 'ArrowLeft' ? 'up' : 'down');
                return;
              }

              if (event.key === 'ArrowRight') {
                event.preventDefault();
                const nextPane = panes[(index + 1) % panes.length];
                if (nextPane) {
                  onPaneChange(nextPane.id, 'arrow-right');
                }
                return;
              }

              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const nextIndex = (index - 1 + panes.length) % panes.length;
                const nextPane = panes[nextIndex];
                if (nextPane) {
                  onPaneChange(nextPane.id, 'arrow-left');
                }
                return;
              }

              if (event.key === 'Home') {
                event.preventDefault();
                focusByIndex(0);
                return;
              }

              if (event.key === 'End') {
                event.preventDefault();
                focusByIndex(panes.length - 1);
                return;
              }

              if (event.ctrlKey && event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
                const shortcut = Number.parseInt(event.code.slice('Digit'.length), 10);
                const targetPane = paneByShortcut.get(shortcut);
                if (targetPane) {
                  event.preventDefault();
                  onPaneChange(targetPane.id, 'digit');
                }
              }
            }}
            className="rounded-control p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={cn(
                'inline-flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] font-medium transition-[max-width,padding,border-radius,color,background-color,box-shadow] duration-200 motion-reduce:transition-none',
                revealLabel ? 'max-w-28 rounded-control px-2 py-1 delay-[350ms] motion-reduce:delay-0' : 'max-w-2 rounded-full px-0 py-0 delay-0',
                isActive
                  ? 'bg-accent text-on-primary'
                  : isHovered
                    ? 'bg-text text-surface'
                    : 'bg-muted text-muted',
              )}
            >
              {revealLabel ? (
                <>
                  {pane.shortcutNumber ? <span className="opacity-60">{pane.shortcutNumber}</span> : null}
                  <span>{pane.label}</span>
                </>
              ) : (
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--color-primary)',
                          boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent), 0 0 0 4px rgb(255 255 255 / 10%)',
                        }
                      : { backgroundColor: 'var(--color-muted)' }
                  }
                  aria-hidden="true"
                />
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
