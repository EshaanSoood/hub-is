import { Icon } from '../../primitives';

interface ToolbarPanelsProps {
  toolbarDialog: 'calendar' | 'tasks' | 'reminders' | null;
  openQuickNavPanel: (panel: 'calendar' | 'tasks' | 'reminders') => void;
}

const PANEL_BUTTONS: Array<{
  panel: 'calendar' | 'tasks' | 'reminders';
  iconName: 'calendar' | 'tasks' | 'reminders';
  ariaLabel: string;
}> = [
  { panel: 'calendar', iconName: 'calendar', ariaLabel: 'Open calendar' },
  { panel: 'tasks', iconName: 'tasks', ariaLabel: 'Open tasks' },
  { panel: 'reminders', iconName: 'reminders', ariaLabel: 'Open reminders' },
];

export const ToolbarPanels = ({ toolbarDialog, openQuickNavPanel }: ToolbarPanelsProps) => (
  <div className="flex items-center gap-xs">
    {PANEL_BUTTONS.map((item) => {
      const active = toolbarDialog === item.panel;
      return (
        <button
          key={item.panel}
          type="button"
          aria-label={item.ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={active}
          aria-controls={`toolbar-${item.panel}-panel`}
          onClick={() => openQuickNavPanel(item.panel)}
          className={`flex h-7 w-7 items-center justify-center rounded-control border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            active ? 'border-primary bg-primary/10 text-primary' : 'border-border-muted text-muted'
          }`}
        >
          <Icon name={item.iconName} className="text-[14px]" />
        </button>
      );
    })}
  </div>
);
