import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(() => autoOpenKey > 0);
  const initials = useMemo(() => sessionInitials(sessionSummary.name), [sessionSummary.name]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open profile menu"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onOpenProfile}
      >
        <Icon name="user" size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative z-[1] rounded-panel border border-subtle bg-elevated px-3 py-3">
      {menuOpen ? <ProfileMenu onClose={() => setMenuOpen(false)} /> : null}

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-subtle bg-surface text-sm font-semibold text-text"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <SidebarLabel show={showLabels} className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{sessionSummary.name}</p>
          </SidebarLabel>
          <SidebarLabel show={showLabels}>
            <button
              type="button"
              aria-expanded={menuOpen}
              className="interactive interactive-subtle mt-1 inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span>Menu</span>
              <motion.span
                initial={false}
                animate={menuOpen ? 'expanded' : 'collapsed'}
                variants={sidebarChevronVariants(prefersReducedMotion)}
              >
                <Icon name="chevron-down" size={12} />
              </motion.span>
            </button>
          </SidebarLabel>
        </div>
      </div>
    </div>
  );
};
