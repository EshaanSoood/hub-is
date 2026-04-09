import { motion, useReducedMotion } from 'framer-motion';
import type { MutableRefObject } from 'react';
import { Icon } from '../../primitives';
import { dialogLayoutIds } from '../../../styles/motion';

interface ToolbarPanelsProps {
  toolbarDialog: 'calendar' | 'tasks' | 'reminders' | null;
  openQuickNavPanel: (panel: 'calendar' | 'tasks' | 'reminders') => void;
  calendarTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  tasksTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  remindersTriggerRef: MutableRefObject<HTMLButtonElement | null>;
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

export const ToolbarPanels = ({
  toolbarDialog,
  openQuickNavPanel,
  calendarTriggerRef,
  tasksTriggerRef,
  remindersTriggerRef,
}: ToolbarPanelsProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const resolveTriggerRef = (panel: 'calendar' | 'tasks' | 'reminders') => {
    if (panel === 'calendar') {
      return calendarTriggerRef;
    }
    if (panel === 'tasks') {
      return tasksTriggerRef;
    }
    return remindersTriggerRef;
  };
  const resolveDialogLayoutId = (panel: 'calendar' | 'tasks' | 'reminders'): string => {
    if (panel === 'calendar') {
      return dialogLayoutIds.toolbarCalendar;
    }
    if (panel === 'tasks') {
      return dialogLayoutIds.toolbarTasks;
    }
    return dialogLayoutIds.toolbarReminders;
  };

  return (
    <div className="flex items-center gap-xs">
      {PANEL_BUTTONS.map((item) => {
        const active = toolbarDialog === item.panel;
        return (
          <motion.button
            key={item.panel}
            layoutId={!prefersReducedMotion && active ? resolveDialogLayoutId(item.panel) : undefined}
            ref={resolveTriggerRef(item.panel)}
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
          </motion.button>
        );
      })}
    </div>
  );
};
