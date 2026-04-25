import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildRoomHref } from '../../../features/rooms/navigation';
import type { CreateRoomRequest, Room } from '../../../shared/api-types';
import type { ProjectRecord } from '../../../types/domain';
import { Icon } from '../../primitives/Icon';
import { SidebarLabel } from '../motion/SidebarLabel';
import { SidebarSelectionMarker } from '../motion/SidebarSelectionMarker';
import {
  sidebarAccordionContentVariants,
  sidebarAccordionItemVariants,
  sidebarAccordionListVariants,
  sidebarChevronVariants,
} from '../motion/sidebarMotion';
import { CreateRoomDialog } from './CreateRoomDialog';

interface RoomsSectionProps {
  accessToken: string | null | undefined;
  createRoom: (payload: CreateRoomRequest) => Promise<Room>;
  currentRoomId: string | null;
  error: string | null;
  isCollapsed: boolean;
  loading: boolean;
  onExpandSidebar: () => void;
  onToggleSection: () => void;
  projectOptions: ProjectRecord[];
  rooms: Room[];
  sectionExpanded: boolean;
  showLabels: boolean;
}

interface RoomsSectionContentProps {
  accessToken: string | null | undefined;
  activeRooms: Room[];
  createRoom: (payload: CreateRoomRequest) => Promise<Room>;
  currentRoomId: string | null;
  onExpandSidebar: () => void;
  onToggleSection: () => void;
  projectOptions: ProjectRecord[];
  sectionExpanded: boolean;
  showLabels: boolean;
  error: string | null;
  loading: boolean;
}

const RoomsSectionContent = ({
  accessToken,
  activeRooms,
  createRoom,
  currentRoomId,
  onExpandSidebar,
  onToggleSection,
  projectOptions,
  sectionExpanded,
  showLabels,
  error,
  loading,
}: RoomsSectionContentProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const panelId = useId();
  const headingId = useId();
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <section className="sidebar-divider flex shrink-0 flex-col overflow-hidden px-2 py-2" aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <button
          id={headingId}
          type="button"
          aria-expanded={sectionExpanded}
          aria-controls={panelId}
          className="interactive interactive-subtle sidebar-row flex-1 justify-between px-2 py-2 text-left text-sm font-semibold text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={onToggleSection}
        >
          <span className="flex min-w-0 items-center gap-2">
            <motion.span
              initial={false}
              animate={sectionExpanded ? 'expanded' : 'collapsed'}
              variants={sidebarChevronVariants(prefersReducedMotion)}
              className="flex shrink-0"
            >
              <Icon name="chevron-down" size={14} />
            </motion.span>
            <SidebarLabel show={showLabels}>
              <span>Rooms</span>
            </SidebarLabel>
          </span>
        </button>

        <CreateRoomDialog
          accessToken={accessToken}
          onCreateRoom={createRoom}
          projectOptions={projectOptions}
          triggerRef={createTriggerRef}
        />
      </div>

      <AnimatePresence initial={false}>
        {sectionExpanded ? (
          <motion.div
            key="rooms-content"
            id={panelId}
            initial="collapsed"
            animate="expanded"
            exit="exit"
            variants={sidebarAccordionContentVariants(prefersReducedMotion)}
            className="mt-2 overflow-hidden"
          >
            <SidebarLabel show={showLabels} className="sidebar-children-indent">
              {error ? <p className="px-2 py-1 text-xs text-danger">{error}</p> : null}
              {loading ? <p className="px-2 py-1 text-xs text-muted">Loading rooms…</p> : null}
              {!loading && !error ? (
                activeRooms.length > 0 ? (
                  <motion.ul
                    aria-label="Rooms"
                    initial={false}
                    animate="expanded"
                    variants={sidebarAccordionListVariants(prefersReducedMotion)}
                    className="space-y-1"
                  >
                    {activeRooms.map((room) => {
                      const active = room.id === currentRoomId;
                      return (
                        <motion.li
                          key={room.id}
                          variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                          initial="collapsed"
                          animate="expanded"
                        >
                          <button
                            type="button"
                            aria-current={active ? 'page' : undefined}
                            className={`interactive interactive-subtle sidebar-row relative w-full overflow-hidden text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                              active
                                ? 'sidebar-row-button sidebar-row-active'
                                : 'sidebar-row-button text-text-secondary hover:bg-surface-highest hover:text-text'
                            }`}
                            onClick={() => {
                              onExpandSidebar();
                              navigate(buildRoomHref(room.id));
                            }}
                          >
                            {active ? <SidebarSelectionMarker /> : null}
                            <span className="relative z-[1] block truncate">{room.displayName}</span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                ) : (
                  <p className="px-2 py-1 text-sm text-muted">No active rooms.</p>
                )
              ) : null}
            </SidebarLabel>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

export const RoomsSection = ({
  accessToken,
  createRoom,
  currentRoomId,
  error,
  isCollapsed,
  loading,
  onExpandSidebar,
  onToggleSection,
  projectOptions,
  rooms,
  sectionExpanded,
  showLabels,
}: RoomsSectionProps) => {
  const activeRooms = rooms.filter((room) => room.status === 'active');

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open rooms"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control bg-surface-container text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpandSidebar}
      >
        <Icon name="focus" size={16} />
      </button>
    );
  }

  return (
    <RoomsSectionContent
      key={currentRoomId ?? '__rooms-list__'}
      accessToken={accessToken}
      activeRooms={activeRooms}
      createRoom={createRoom}
      currentRoomId={currentRoomId}
      error={error}
      loading={loading}
      onExpandSidebar={onExpandSidebar}
      onToggleSection={onToggleSection}
      projectOptions={projectOptions}
      sectionExpanded={sectionExpanded}
      showLabels={showLabels}
    />
  );
};
