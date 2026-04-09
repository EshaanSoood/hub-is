import type { ComponentProps, MutableRefObject } from 'react';
import { requestHubHomeRefresh } from '../../../../lib/hubHomeRefresh';
import { createEventFromNlp } from '../../../../services/hub/records';
import { dialogLayoutIds } from '../../../../styles/motion';
import { CalendarModuleSkin } from '../../../project-space/CalendarModuleSkin';
import { Dialog } from '../../../primitives';
import type { ToolbarDialog } from '../../appShellUtils';

interface CalendarDialogProps {
  toolbarDialog: ToolbarDialog;
  closeQuickNavPanel: () => void;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  personalCalendarError: string | null;
  refreshPersonalCalendar: () => Promise<void>;
  personalCalendarEvents: ComponentProps<typeof CalendarModuleSkin>['events'];
  personalCalendarLoading: ComponentProps<typeof CalendarModuleSkin>['loading'];
  personalCalendarMode: ComponentProps<typeof CalendarModuleSkin>['scope'];
  setPersonalCalendarMode: ComponentProps<typeof CalendarModuleSkin>['onScopeChange'];
  onOpenCalendarRecordFromDialog: ComponentProps<typeof CalendarModuleSkin>['onOpenRecord'];
  accessToken: string | undefined;
  toolbarCalendarCreateProjectId: string | null;
}

export const CalendarDialog = ({
  toolbarDialog,
  closeQuickNavPanel,
  triggerRef,
  personalCalendarError,
  refreshPersonalCalendar,
  personalCalendarEvents,
  personalCalendarLoading,
  personalCalendarMode,
  setPersonalCalendarMode,
  onOpenCalendarRecordFromDialog,
  accessToken,
  toolbarCalendarCreateProjectId,
}: CalendarDialogProps) => (
  <Dialog
    open={toolbarDialog === 'calendar'}
    onClose={closeQuickNavPanel}
    triggerRef={triggerRef}
    layoutId={dialogLayoutIds.toolbarCalendar}
    title="Calendar"
    description="Your personal calendar across all projects."
    panelClassName="dialog-panel-expanded-size !top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden"
    contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <div id="toolbar-calendar-panel" className="flex min-h-0 flex-1 flex-col gap-3">
      {personalCalendarError ? (
        <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
          <p className="text-sm text-danger">{personalCalendarError}</p>
          <button
            type="button"
            onClick={() => {
              void refreshPersonalCalendar();
            }}
            className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <CalendarModuleSkin
          events={personalCalendarEvents}
          loading={personalCalendarLoading}
          scope={personalCalendarMode}
          onScopeChange={setPersonalCalendarMode}
          onOpenRecord={onOpenCalendarRecordFromDialog}
          onCreateEvent={
            accessToken && toolbarCalendarCreateProjectId
              ? async (payload) => {
                await createEventFromNlp(accessToken, toolbarCalendarCreateProjectId, payload);
                requestHubHomeRefresh();
                await refreshPersonalCalendar();
              }
              : undefined
          }
        />
      </div>
    </div>
  </Dialog>
);
