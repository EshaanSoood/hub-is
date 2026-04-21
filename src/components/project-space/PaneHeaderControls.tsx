import { useMemo, useState } from 'react';
import { Icon, IconButton, Popover, PopoverContent, PopoverTrigger, ToggleButton } from '../primitives';
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
    <div className="module-toolbar flex flex-wrap items-center gap-2 p-2">
      <input
        type="text"
        value={paneName}
        onChange={(event) => onRename(event.target.value)}
        aria-label="Pane name"
        disabled={disabled}
        className="ghost-button min-w-56 flex-1 bg-surface px-3 py-1.5 text-sm font-semibold text-text"
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
            className={cn(configOpen && 'text-primary')}
          >
            <Icon name="settings" className="text-[14px]" />
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
        className={cn(isPinned && 'text-primary')}
      >
        <Icon name="pin" className="text-[14px]" />
      </IconButton>

      <IconButton
        type="button"
        size="sm"
        variant={isFocusMode ? 'secondary' : 'ghost'}
        aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
        aria-pressed={isFocusMode}
        disabled={disabled}
        onClick={onFocusToggle}
        className={cn(isFocusMode && 'text-primary')}
      >
        <Icon name="focus" className="text-[14px]" />
      </IconButton>
    </div>
  );
};
