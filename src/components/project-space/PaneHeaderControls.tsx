import { useMemo, useState } from 'react';
import { IconButton, Popover, PopoverContent, PopoverTrigger, ToggleButton } from '../primitives';
import type { AudienceMode } from './types';
import { cn } from '../../lib/cn';

interface AudienceOption {
  id: AudienceMode;
  label: string;
}

interface RegionOption {
  id: 'modules' | 'workspace';
  label: string;
  enabled: boolean;
  disabled?: boolean;
}

interface PaneHeaderControlsProps {
  paneName: string;
  onRename: (name: string) => void;
  isPinned: boolean;
  onPinToggle: () => void;
  isFocusMode: boolean;
  onFocusToggle: () => void;
  audience: AudienceMode;
  audienceOptions: AudienceOption[];
  onAudienceChange: (audience: AudienceMode) => void;
  regions: RegionOption[];
  onRegionToggle: (regionId: RegionOption['id'], nextEnabled: boolean) => void;
  disabled?: boolean;
}

const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
);

const FocusIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r={active ? '4' : '2'} fill={active ? 'currentColor' : 'none'} />
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
  </svg>
);

const TuneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="8" cy="6" r="2" fill="currentColor" />
    <circle cx="16" cy="12" r="2" fill="currentColor" />
    <circle cx="10" cy="18" r="2" fill="currentColor" />
  </svg>
);

export const PaneHeaderControls = ({
  paneName,
  onRename,
  isPinned,
  onPinToggle,
  isFocusMode,
  onFocusToggle,
  audience,
  audienceOptions,
  onAudienceChange,
  regions,
  onRegionToggle,
  disabled = false,
}: PaneHeaderControlsProps) => {
  const [configOpen, setConfigOpen] = useState(false);

  const activeAudienceLabel = useMemo(
    () => audienceOptions.find((option) => option.id === audience)?.label ?? audience,
    [audience, audienceOptions],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-panel border border-subtle bg-elevated p-2">
      <input
        type="text"
        value={paneName}
        onChange={(event) => onRename(event.target.value)}
        aria-label="Pane name"
        disabled={disabled}
        className="min-w-56 flex-1 rounded-control border border-subtle bg-surface px-3 py-1.5 text-sm font-semibold text-text"
      />

      <p className="text-xs text-muted">Audience: {activeAudienceLabel}</p>

      <div className="mx-1 hidden h-4 w-px bg-border-subtle sm:block" aria-hidden="true" />

      <Popover open={configOpen} onOpenChange={setConfigOpen}>
        <PopoverTrigger asChild>
          <IconButton
            type="button"
            size="sm"
            variant={configOpen ? 'secondary' : 'ghost'}
            aria-label="Pane configuration"
            aria-expanded={configOpen}
            disabled={disabled}
          >
            <TuneIcon />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Audience</p>
            <div role="group" aria-label="Audience" className="flex flex-wrap gap-1">
              {audienceOptions.map((option) => (
                <ToggleButton
                  key={option.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  pressed={audience === option.id}
                  onPressedChange={() => onAudienceChange(option.id)}
                  disabled={disabled}
                >
                  {option.label}
                </ToggleButton>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Regions</p>
            <div role="group" aria-label="Regions" className="flex flex-wrap gap-1">
              {regions.map((region) => (
                <ToggleButton
                  key={region.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  pressed={region.enabled}
                  disabled={disabled || region.disabled}
                  onPressedChange={(nextPressed) => onRegionToggle(region.id, nextPressed)}
                  className={cn(region.disabled && 'opacity-60')}
                >
                  {region.label}
                </ToggleButton>
              ))}
            </div>
          </section>
        </PopoverContent>
      </Popover>

      <IconButton
        type="button"
        size="sm"
        variant={isPinned ? 'secondary' : 'ghost'}
        aria-label={isPinned ? 'Unpin pane' : 'Pin pane'}
        aria-pressed={isPinned}
        disabled={disabled}
        onClick={onPinToggle}
      >
        <PinIcon filled={isPinned} />
      </IconButton>

      <IconButton
        type="button"
        size="sm"
        variant={isFocusMode ? 'secondary' : 'ghost'}
        aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
        aria-pressed={isFocusMode}
        disabled={disabled}
        onClick={onFocusToggle}
      >
        <FocusIcon active={isFocusMode} />
      </IconButton>
    </div>
  );
};
