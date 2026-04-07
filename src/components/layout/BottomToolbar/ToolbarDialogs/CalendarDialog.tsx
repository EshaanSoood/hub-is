import { requestHubHomeRefresh } from '../../../../lib/hubHomeRefresh';
import { createEventFromNlp } from '../../../../services/hub/records';
import { CalendarModuleSkin, type CalendarScope } from '../../../project-space/CalendarModuleSkin';
import { Dialog } from '../../../primitives';
import type { BottomToolbarProps } from '../types';

type CalendarDialogProps = Pick<
  BottomToolbarProps,
  | 'toolbarDialog'
  | 'closeQuickNavPanel'
  | 'quickNavTriggerRef'
  | 'personalCalendarError'
  | 'refreshPersonalCalendar'
  | 'personalCalendarEvents'
  | 'personalCalendarLoading'
  | 'personalCalendarMode'
  | 'setPersonalCalendarMode'
  | 'onOpenCalendarRecordFromDialog'
  | 'accessToken'
  | 'toolbarCalendarCreateProjectId'
>;

export const CalendarDialog = ({
  toolbarDialog,
  closeQuickNavPanel,
  quickNavTriggerRef,
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
    triggerRef={quickNavTriggerRef}
    title="Calendar"
    description="Your personal calendar across all projects."
    panelClassName="dialog-panel-expanded-size !top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden"
    contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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
          scope={personalCalendarMode as CalendarScope}
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
