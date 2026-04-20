import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthz } from '../../../context/AuthzContext';
import { SidebarLabel } from '../motion/SidebarLabel';
import { sidebarChevronVariants } from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import { ProfileMenu } from './ProfileMenu';

const sessionInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.charAt(0) || ''}${words[1]?.charAt(0) || ''}`.toUpperCase();
  }
  return (words[0] || '?').slice(0, 2).toUpperCase();
};

interface ProfileBadgeProps {
  autoOpenKey: number;
  isCollapsed: boolean;
  onOpenProfile: () => void;
  showLabels: boolean;
}

export const ProfileBadge = ({
  autoOpenKey,
  isCollapsed,
  onOpenProfile,
  showLabels,
}: ProfileBadgeProps) => {
  const { sessionSummary } = useAuthz();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(() => autoOpenKey > 0);
  const initials = useMemo(() => sessionInitials(sessionSummary.name), [sessionSummary.name]);
  const menuId = useId();

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeMenuAndRestoreFocus = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      menuButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenuAndRestoreFocus();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMenu, closeMenuAndRestoreFocus, menuOpen]);

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open profile menu"
        className="ghost-button interactive interactive-subtle flex h-10 w-10 items-center justify-center bg-surface text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenProfile}
      >
        <Icon name="user" size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="paper-card relative z-[1] px-4 py-3">
      {menuOpen ? (
        <ProfileMenu
          id={menuId}
          onCloseAndRestoreFocus={closeMenuAndRestoreFocus}
        />
      ) : null}

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="paper-well flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-highest text-sm font-semibold text-text"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <SidebarLabel show={showLabels} className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{sessionSummary.name}</p>
          </SidebarLabel>
          <SidebarLabel show={showLabels}>
            <button
              ref={menuButtonRef}
              type="button"
              aria-controls={menuOpen ? menuId : undefined}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="ghost-button interactive interactive-subtle mt-1 inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span>Menu</span>
              <motion.span
                initial={false}
                animate={menuOpen ? 'expanded' : 'collapsed'}
                variants={sidebarChevronVariants(prefersReducedMotion)}
              >
                <Icon name="chevron-down" size={14} weight="bold" />
              </motion.span>
            </button>
          </SidebarLabel>
        </div>
      </div>
    </div>
  );
};
