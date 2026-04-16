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
  standard: 'gap-2',
  compact: 'gap-1',
};

const tabButtonClass: Record<TabsVariant, string> = {
  standard: 'rounded-panel border border-subtle px-3 py-2 text-sm font-semibold',
  compact: 'rounded-control border border-subtle px-2 py-1 text-xs font-semibold',
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
        selected && 'border-secondary/40 bg-secondary text-on-secondary',
        'data-[state=inactive]:border-secondary/30 data-[state=inactive]:bg-surface data-[state=inactive]:text-secondary data-[state=inactive]:hover:border-secondary/45 data-[state=inactive]:hover:bg-secondary/10 data-[state=inactive]:hover:text-secondary-strong data-[state=active]:border-secondary/40 data-[state=active]:bg-secondary data-[state=active]:text-on-secondary',
        className,
      )}
      {...props}
    />
  ),
);

TabButton.displayName = 'TabButton';
