import { useMemo, useState } from 'react';
import { Button, Icon, Popover, PopoverContent, PopoverTrigger } from '../primitives';
import type { ClientReference, Collaborator } from './types';
import { COLLABORATOR_TONES } from './designTokens';
import { cn } from '../../lib/cn';

interface OverviewHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  startDateLabel: string;
  collaborators: Collaborator[];
  refs: ClientReference[];
  onInvite: () => void;
}

export const OverviewHeader = ({
  title,
  onTitleChange,
  startDateLabel,
  collaborators,
  refs,
  onInvite,
}: OverviewHeaderProps) => {
  const [refsOpen, setRefsOpen] = useState(false);

  const collaboratorBadges = useMemo(
    () => collaborators.map((collaborator, index) => ({
      ...collaborator,
      toneClass: COLLABORATOR_TONES[index % COLLABORATOR_TONES.length],
    })),
    [collaborators],
  );

  return (
    <header className="rounded-panel border border-subtle bg-elevated p-4">
      <input
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        aria-label="Project title"
        className="w-full rounded-control border border-transparent bg-transparent px-1 py-0.5 text-xl font-bold text-text"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <Icon name="calendar" className="text-[11px]" />
          {startDateLabel}
        </span>

        <span className="hidden h-3 w-px bg-border-subtle sm:inline-block" aria-hidden="true" />

        <div className="flex items-center" aria-label="Collaborators">
          {collaboratorBadges.map((collaborator, index) => (
            <span
              key={collaborator.id}
              title={`${collaborator.name} (${collaborator.role})`}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-elevated text-[11px] font-bold text-surface',
                collaborator.toneClass,
                index > 0 && '-ml-1.5',
              )}
            >
              {collaborator.name.slice(0, 1).toUpperCase()}
            </span>
          ))}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onInvite}
            aria-label="Invite collaborator"
            className="ml-1 h-7 w-7 rounded-full p-0"
          >
            <Icon name="plus" className="text-[14px]" />
          </Button>
        </div>

        <span className="hidden h-3 w-px bg-border-subtle sm:inline-block" aria-hidden="true" />

        <Popover open={refsOpen} onOpenChange={setRefsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={refsOpen ? 'primary' : 'secondary'}
              aria-expanded={refsOpen}
              aria-label="Quick references"
              className="ml-auto"
            >
              {refs.length} refs
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quick references</p>
            {refs.map((ref) => (
              <div key={ref.id} className="rounded-control border border-subtle bg-surface px-2 py-1.5">
                <p className="text-xs font-semibold text-text">{ref.name}</p>
                <p className="text-xs text-muted">{ref.contact}</p>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};
