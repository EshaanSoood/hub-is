import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import type { ProjectLateralSource } from '../motion/hubMotion';

export interface ProjectSwitcherProject {
  id: string;
  label: string;
  shortcutNumber?: number;
  disabled?: boolean;
}

interface ProjectSwitcherProps {
  id?: string;
  projects: ProjectSwitcherProject[];
  activeProjectId: string | null;
  onProjectChange: (projectId: string, source: ProjectLateralSource) => void;
  onMoveProject?: (projectId: string, direction: 'up' | 'down') => void;
}

export const ProjectSwitcher = ({ id, projects, activeProjectId, onProjectChange, onMoveProject }: ProjectSwitcherProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const projectRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const projectByShortcut = useMemo(() => {
    const map = new Map<number, ProjectSwitcherProject>();
    for (const project of projects) {
      if (project.shortcutNumber) {
        map.set(project.shortcutNumber, project);
      }
    }
    return map;
  }, [projects]);

  const focusByIndex = (index: number) => {
    if (projects.length === 0) {
      return;
    }
    const clamped = (index + projects.length) % projects.length;
    projectRefs.current[clamped]?.focus();
  };

  if (projects.length === 0) {
    return <p className="text-xs text-muted">No projects available.</p>;
  }

  return (
    <div id={id} role="toolbar" aria-label="Project switcher" className="flex items-center gap-0.5 px-2 py-1">
      <span className="sr-only">
        Use Left and Right arrows to navigate between projects. Use Home and End to move focus to first and last projects. Use Ctrl plus arrows to reorder projects.
      </span>
      {projects.map((project, index) => {
        const isActive = project.id === activeProjectId;
        const isHovered = hoveredProjectId === project.id;
        const revealLabel = isHovered || isActive;

        return (
          <motion.button
            key={project.id}
            layoutId={!prefersReducedMotion ? `project-${project.id}` : undefined}
            ref={(node) => {
              projectRefs.current[index] = node;
            }}
            type="button"
            aria-pressed={isActive}
            aria-label={`${project.label}${project.shortcutNumber ? `, project ${project.shortcutNumber}` : ''}`}
            disabled={project.disabled}
            onClick={() => onProjectChange(project.id, 'click')}
            aria-keyshortcuts={onMoveProject ? 'Control+ArrowLeft Control+ArrowRight' : undefined}
            onMouseEnter={() => setHoveredProjectId(project.id)}
            onMouseLeave={() => setHoveredProjectId((current) => (current === project.id ? null : current))}
            onFocus={() => setHoveredProjectId(project.id)}
            onBlur={() => setHoveredProjectId((current) => (current === project.id ? null : current))}
            onKeyDown={(event) => {
              if (event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && onMoveProject) {
                event.preventDefault();
                onMoveProject(project.id, event.key === 'ArrowLeft' ? 'up' : 'down');
                return;
              }

              if (event.key === 'ArrowRight') {
                event.preventDefault();
                const nextProject = projects[(index + 1) % projects.length];
                if (nextProject) {
                  onProjectChange(nextProject.id, 'arrow-right');
                }
                return;
              }

              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                const nextIndex = (index - 1 + projects.length) % projects.length;
                const nextProject = projects[nextIndex];
                if (nextProject) {
                  onProjectChange(nextProject.id, 'arrow-left');
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
                focusByIndex(projects.length - 1);
                return;
              }

              if (event.ctrlKey && event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
                const shortcut = Number.parseInt(event.code.slice('Digit'.length), 10);
                const targetProject = projectByShortcut.get(shortcut);
                if (targetProject) {
                  event.preventDefault();
                  onProjectChange(targetProject.id, 'digit');
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
                  {project.shortcutNumber ? <span className="opacity-60">{project.shortcutNumber}</span> : null}
                  <span>{project.label}</span>
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
