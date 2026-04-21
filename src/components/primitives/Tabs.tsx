import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import { handleRovingTabKeyDown } from '../project-space/tabKeyboard';
import {
  Tabs as TabsRoot,
  TabsContent,
  TabsList as TabsListPrimitive,
  TabsTrigger,
} from '../ui/tabs';

type TabsVariant = 'standard' | 'compact';

const tabsListClass: Record<TabsVariant, string> = {
  standard: 'gap-2 rounded-panel bg-surface-low p-1',
  compact: 'gap-1 rounded-panel bg-surface-low p-1',
};

const tabButtonClass: Record<TabsVariant, string> = {
  standard: 'rounded-panel px-3 py-2 text-sm font-semibold transition-[background-color,color,box-shadow]',
  compact: 'rounded-control px-2 py-1 text-xs font-semibold transition-[background-color,color,box-shadow]',
};

export const Tabs = TabsRoot;
export { TabsContent };

export const buildTabsKeyDownHandler = <T extends string>(options: {
  items: readonly T[];
  activeId: T;
  onNavigate: (id: T) => void;
  focusByIndex: (index: number) => void;
}) =>
  (event: React.KeyboardEvent<HTMLDivElement>) =>
    handleRovingTabKeyDown({
      event,
      items: options.items,
      activeId: options.activeId,
      onNavigate: options.onNavigate,
      focusByIndex: options.focusByIndex,
    });

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive> & { variant?: TabsVariant }
>(({ variant = 'standard', className, ...props }, ref) => (
  <TabsListPrimitive ref={ref} className={cn('flex flex-wrap', tabsListClass[variant], className)} {...props} />
));
TabsList.displayName = 'TabsList';

interface TabButtonProps extends React.ComponentPropsWithoutRef<typeof TabsTrigger> {
  variant?: TabsVariant;
  selected?: boolean;
}

export const TabButton = forwardRef<React.ElementRef<typeof TabsTrigger>, TabButtonProps>(
  ({ variant = 'standard', selected = false, className, ...props }, ref) => (
    <TabsTrigger
      ref={ref}
      className={cn(
        tabButtonClass[variant],
        selected && 'cta-primary text-on-primary',
        'data-[state=inactive]:bg-surface data-[state=inactive]:text-secondary data-[state=inactive]:hover:bg-surface-container data-[state=inactive]:hover:text-secondary-strong data-[state=inactive]:hover:ring-1 data-[state=inactive]:hover:ring-border-muted data-[state=active]:cta-primary data-[state=active]:text-on-primary',
        className,
      )}
      {...props}
    />
  ),
);

TabButton.displayName = 'TabButton';
