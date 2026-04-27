import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HubProjectSummary } from '../../../services/hub/types';
import { useNotifications } from '../../../hooks/useNotifications';
import type { ProjectRecord } from '../../../types/domain';
import { CaptureInput } from '../../Sidebar/CaptureInput';
import type { SidebarCaptureSurface } from '../../Sidebar/CaptureInput/shared';
import { Icon } from '../../primitives/Icon';
import { NotificationsPanel } from '../NotificationsPanel';
import {
  type NotificationFilter,
  type ToolbarNotification,
  toToolbarNotification,
} from '../appShellUtils';

const FOCUSABLE_PANEL_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isVisibleElement = (element: HTMLElement): boolean => {
  if (element.hidden || element.closest('[hidden],[inert],[aria-hidden="true"]')) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
};

const focusablePanelElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_PANEL_SELECTOR)).filter(isVisibleElement);

const focusFirstPanelElement = (container: HTMLElement): void => {
  const [firstFocusable] = focusablePanelElements(container);
  (firstFocusable ?? container).focus({ preventScroll: true });
};

interface AppCommandBarProps {
  accessToken: string | null | undefined;
  currentProjectId: string | null;
  currentProject: ProjectRecord | null;
  currentProjectProjects: HubProjectSummary[];
  currentSurface: SidebarCaptureSurface;
  onOpenQuickThoughts: () => void;
  personalProject: ProjectRecord | null;
  spaces: Array<{ id: string; name: string }>;
}

export const AppCommandBar = ({
  accessToken,
  currentProjectId,
  currentProject,
  currentProjectProjects,
  currentSurface,
  onOpenQuickThoughts,
  personalProject,
  spaces,
}: AppCommandBarProps) => {
  const navigate = useNavigate();
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsContainerRef = useRef<HTMLDivElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('unread');
  const [notificationProjectFilter, setNotificationProjectFilter] = useState<string | null>(null);
  const {
    markAsRead,
    notifications,
    unreadCount,
  } = useNotifications(accessToken);
  const toolbarNotifications = useMemo(
    () => notifications.map(toToolbarNotification),
    [notifications],
  );
  const notificationBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const notificationStatus = unreadCount > 0
    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
    : 'No unread notifications';

  const closeNotifications = useCallback((restoreFocus = true) => {
    setNotificationsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        notificationButtonRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    const panel = notificationsPanelRef.current;
    if (panel) {
      focusFirstPanelElement(panel);
    }
    const focusFrame = window.requestAnimationFrame(() => {
      const nextPanel = notificationsPanelRef.current;
      if (nextPanel) {
        focusFirstPanelElement(nextPanel);
      }
    });

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && notificationsContainerRef.current?.contains(target)) {
        return;
      }
      closeNotifications();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNotifications();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const nextPanel = notificationsPanelRef.current;
      if (!nextPanel) {
        return;
      }
      const focusable = focusablePanelElements(nextPanel);
      if (focusable.length === 0) {
        event.preventDefault();
        nextPanel.focus({ preventScroll: true });
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const activeInside = activeElement instanceof HTMLElement && nextPanel.contains(activeElement);

      if (event.shiftKey && (!activeInside || activeElement === firstFocusable)) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && (!activeInside || activeElement === lastFocusable)) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeNotifications, notificationsOpen]);

  const handleNotificationNavigate = useCallback(
    (notification: ToolbarNotification) => {
      void (async () => {
        try {
          await markAsRead(notification.id);
        } finally {
          navigate(notification.href);
          closeNotifications(false);
        }
      })();
    },
    [closeNotifications, markAsRead, navigate],
  );

  return (
    <header className="command-center-surface rounded-panel px-5 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="shrink-0 xl:w-28">
          <p className="text-sm font-semibold text-secondary-strong">Capture.</p>
        </div>

        <div className="min-w-0 flex-1 xl:flex xl:justify-center">
          <div className="min-w-0 xl:w-full xl:max-w-3xl">
            <CaptureInput
              accessToken={accessToken}
              autoFocusKey={0}
              currentProjectId={currentProjectId}
              currentProject={currentProject}
              currentProjectProjects={currentProjectProjects}
              currentSurface={currentSurface}
              currentSurfaceLabel={null}
              isCollapsed={false}
              onOpenCapture={() => {}}
              personalProject={personalProject}
              placeholder="Capture anything and experience the magic."
              showLabels
              variant="command-bar"
            />
          </div>
        </div>

        <div className="xl:flex xl:justify-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              data-home-launcher="thoughts"
              onClick={onOpenQuickThoughts}
              className="ghost-button inline-flex h-10 items-center gap-2 bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Icon name="thought-pile" size={14} />
              <span>Quick thoughts</span>
            </button>

            <div ref={notificationsContainerRef} className="relative">
              <button
                ref={notificationButtonRef}
                type="button"
                aria-label="Notifications"
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                title="Notifications"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="ghost-button relative inline-flex h-10 w-10 items-center justify-center bg-surface text-text transition-colors hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon name={unreadCount > 0 ? 'bell-unread' : 'bell-read'} size={18} />
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-on-primary ring-2 ring-surface"
                  >
                    {notificationBadgeLabel}
                  </span>
                ) : null}
              </button>
              <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {notificationStatus}
              </span>

              <AnimatePresence>
                {notificationsOpen ? (
                  <NotificationsPanel
                    notifications={toolbarNotifications}
                    filter={notificationFilter}
                    onFilterChange={setNotificationFilter}
                    projectFilter={notificationProjectFilter}
                    onProjectFilterChange={setNotificationProjectFilter}
                    projects={spaces}
                    onNavigate={handleNotificationNavigate}
                    panelRef={notificationsPanelRef}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
