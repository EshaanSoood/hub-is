import { AnimatePresence } from 'framer-motion';
import { AnimatedSurface } from '../../components/motion/AnimatedSurface';
import { Icon, Popover, PopoverContent, PopoverTrigger } from '../../components/primitives';

interface ProjectLensFilterSection {
  id: string;
  name: string;
}

interface ProjectLensFilterProps {
  sections: ProjectLensFilterSection[];
  hiddenSections: Record<string, boolean>;
  filterOpen: boolean;
  filterListId: string;
  filterLabel: string;
  onFilterOpenChange: (open: boolean) => void;
  onToggleSection: (sectionId: string, visible: boolean) => void;
}

export const ProjectLensFilter = ({
  sections,
  hiddenSections,
  filterOpen,
  filterListId,
  filterLabel,
  onFilterOpenChange,
  onToggleSection,
}: ProjectLensFilterProps) => (
  <Popover open={filterOpen} onOpenChange={onFilterOpenChange}>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={filterOpen}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-control border border-border-muted bg-surface px-3 text-xs font-medium text-text"
      >
        <Icon name="filter" className="text-[12px]" />
        <span>{filterLabel}</span>
      </button>
    </PopoverTrigger>
    <AnimatePresence>
      {filterOpen ? (
        <PopoverContent forceMount asChild align="center">
          <AnimatedSurface
            transformOrigin="bottom center"
            className="w-64 border border-border-muted bg-surface p-2"
          >
            <div id={filterListId} role="group" aria-label="Space Lens filters" className="space-y-1">
              {sections.map((section) => {
                const checked = !hiddenSections[section.id];
                return (
                  <label
                    key={section.id}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-text hover:bg-surface-elevated"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSection(section.id, !checked)}
                    />
                    <span className="truncate">{section.name}</span>
                  </label>
                );
              })}
            </div>
          </AnimatedSurface>
        </PopoverContent>
      ) : null}
    </AnimatePresence>
  </Popover>
);
