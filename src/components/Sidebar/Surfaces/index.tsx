import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { HomeContentViewId, HomeOverlayId, HomeTabId } from '../../../features/home/navigation';
import { SidebarLabel } from '../motion/SidebarLabel';
import {
  sidebarAccordionContentVariants,
  sidebarAccordionItemVariants,
  sidebarAccordionListVariants,
  sidebarChevronVariants,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import type { IconName } from '../../primitives/Icon';
import { SurfaceItem } from './SurfaceItem';

export type SidebarSurfaceId = HomeOverlayId;
export type SidebarHomeContentViewId = HomeContentViewId;
export type SidebarHomeTabId = HomeTabId;

const HOME_CONTENT_ITEMS: Array<{
  id: SidebarHomeContentViewId;
  iconName: IconName;
  label: string;
}> = [
  { id: 'project', iconName: 'home', label: 'Personal Space' },
  { id: 'lenses', iconName: 'focus', label: 'Hub' },
  { id: 'stream', iconName: 'timeline', label: 'Stream' },
];

interface SurfacesProps {
  activeHomeContentView: SidebarHomeContentViewId;
  activeHomeTab: SidebarHomeTabId;
  sectionExpanded: boolean;
  onToggleSection: () => void;
  onSelectHomeContentView: (viewId: SidebarHomeContentViewId) => void;
  isCollapsed: boolean;
  showLabels: boolean;
}

export const Surfaces = ({
  activeHomeContentView,
  activeHomeTab,
  sectionExpanded,
  onToggleSection,
  onSelectHomeContentView,
  isCollapsed,
  showLabels,
}: SurfacesProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div role="group" aria-label="Home views" className="flex flex-col items-center gap-2">
          {HOME_CONTENT_ITEMS.map((view) => (
            <SurfaceItem
              key={view.id}
              active={activeHomeTab === 'overview' && activeHomeContentView === view.id}
              id={view.id}
              iconName={view.iconName}
              isCollapsed
              label={view.label}
              onClick={() => onSelectHomeContentView(view.id)}
              showLabels={showLabels}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="sidebar-divider flex flex-col overflow-hidden px-2 py-2">
      <button
        type="button"
        aria-expanded={sectionExpanded}
        className="interactive interactive-subtle sidebar-row w-full justify-between px-2 py-2 text-left text-sm font-semibold text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
            <span>Home Views</span>
          </SidebarLabel>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {sectionExpanded ? (
          <motion.div
            key="surfaces-content"
            initial="collapsed"
            animate="expanded"
            exit="exit"
            variants={sidebarAccordionContentVariants(prefersReducedMotion)}
            className="mt-2 overflow-hidden"
          >
            <motion.div
              initial={false}
              animate="expanded"
              variants={sidebarAccordionListVariants(prefersReducedMotion)}
              className="sidebar-section sidebar-children-indent"
            >
              {HOME_CONTENT_ITEMS.map((view) => (
                <motion.div
                  key={view.id}
                  variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                  initial="collapsed"
                  animate="expanded"
                >
                  <SurfaceItem
                    active={activeHomeTab === 'overview' && activeHomeContentView === view.id}
                    id={view.id}
                    iconName={view.iconName}
                    isCollapsed={false}
                    label={view.label}
                    onClick={() => onSelectHomeContentView(view.id)}
                    showLabels={showLabels}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
