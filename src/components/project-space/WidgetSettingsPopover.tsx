import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';

interface WidgetSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}

export const WidgetSettingsPopover = ({
  open,
  onOpenChange,
  trigger,
  title,
  children,
}: WidgetSettingsPopoverProps) => (
  <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent align="end" className="w-56 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      </div>
      {children}
    </PopoverContent>
  </Popover>
);
