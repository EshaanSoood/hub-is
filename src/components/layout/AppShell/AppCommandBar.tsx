import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { HubProjectSummary } from '../../../services/hub/types';
import { useNotifications } from '../../../hooks/useNotifications';
import type { ProjectRecord } from '../../../types/domain';
import { buildHomeSurfaceHref, parseHomeSurfaceId, type HomeSurfaceId } from '../../../features/home/navigation';
import { CaptureInput } from '../../Sidebar/CaptureInput';
import type { SidebarCaptureSurface } from '../../Sidebar/CaptureInput/shared';
import { Icon, Popover, PopoverContent, PopoverTrigger } from '../../primitives';
import { NotificationsPanel } from '../NotificationsPanel';
import {
  type NotificationFilter,
  type ToolbarNotification,
  toToolbarNotification,
} from '../appShellUtils';
import type { ShellHeaderConfig, ShellNavItem } from './ShellHeaderContext';

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
  headerConfig: ShellHeaderConfig;
  onOpenQuickThoughts: () => void;
  personalProject: ProjectRecord | null;
  spaces: Array<{ id: string; name: string }>;
}

const fixedHomeSurfaces = ['hub', 'calendar', 'tasks', 'reminders'] as const satisfies ReadonlyArray<HomeSurfaceId>;
const homeSurfaceLabels: Record<(typeof fixedHomeSurfaces)[number], string> = {
  hub: 'Hub',
  calendar: 'Calendar',
  tasks: 'Tasks',
  reminders: 'Reminders',
};

const navButtonClassName = (selected: boolean): string =>
  `rounded-control px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
    selected
      ? 'bg-primary text-on-primary'
      : 'bg-surface text-secondary hover:bg-surface-container hover:text-secondary-strong'
  }`;

export const AppCommandBar = ({
  accessToken,
  currentProjectId,
  currentProject,
  currentProjectProjects,
  currentSurface,
  headerConfig,
  onOpenQuickThoughts,
  personalProject,
  spaces,
}: AppCommandBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsContainerRef = useRef<HTMLDivElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('unread');
  const [notificationProjectFilter, setNotificationProjectFilter] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
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
  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const activeHomeSurface = isOnHome ? parseHomeSurfaceId(new URLSearchParams(location.search).get('surface')) : null;
  const fixedNavItems = useMemo<ShellNavItem[]>(
    () => {
      const contextualItems = new Map((headerConfig.navItems ?? []).map((item) => [item.id, item]));
      return fixedHomeSurfaces.map((surface) => {
        const contextualItem = contextualItems.get(surface);
        return contextualItem ?? {
          id: surface,
          label: homeSurfaceLabels[surface],
          selected: activeHomeSurface === surface,
          href: buildHomeSurfaceHref(surface),
        };
      });
    },
    [activeHomeSurface, headerConfig.navItems],
  );
  const fixedIds = useMemo(() => new Set<string>(fixedHomeSurfaces), []);
  const variableNavItems = useMemo(
    () => (headerConfig.navItems ?? []).filter((item) => !fixedIds.has(item.id)),
    [fixedIds, headerConfig.navItems],
  );
  const navItems = useMemo(
    () => [...fixedNavItems, ...variableNavItems],
    [fixedNavItems, variableNavItems],
  );
  const placeTitle = headerConfig.placeTitle || (isOnHome ? 'Home' : currentProject?.name ?? 'Home');
  const backAction = headerConfig.backAction;
  const canRenamePlace = Boolean(headerConfig.onRenamePlace && headerConfig.placeKind && headerConfig.placeKind !== 'home');
  const placeActions = headerConfig.placeActions ?? [];
  const backActionHref = backAction?.href;
  const backActionState = backAction?.state;
  const backActionLabel = backAction?.label;

  useEffect(() => {
    setRenameDraft(placeTitle);
  }, [placeTitle]);

  useEffect(() => {
    if (!renameOpen) {
      return;
    }
    window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [renameOpen]);

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

  const submitRename = useCallback(() => {
    const nextName = renameDraft.trim();
    if (!nextName || nextName === placeTitle || !headerConfig.onRenamePlace) {
      setRenameOpen(false);
      setRenameDraft(placeTitle);
      return;
    }
    void Promise.resolve(headerConfig.onRenamePlace(nextName)).finally(() => {
      setRenameOpen(false);
    });
  }, [headerConfig, placeTitle, renameDraft]);

  const triggerBackAction = useCallback(() => {
    if (!backActionHref) {
      return;
    }
    navigate(backActionHref, { state: backActionState });
  }, [backActionHref, backActionState, navigate]);

  return (
    <header className="command-center-surface rounded-panel px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <nav aria-label="Primary" className="min-w-0 xl:basis-1/2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {navItems.map((item) => (
                item.href ? (
                  <Link
                    key={item.id}
                    to={item.href}
                    state={item.state}
                    className={navButtonClassName(item.selected)}
                    aria-current={item.selected ? 'page' : undefined}
                    aria-label={item.ariaLabel}
                    data-home-launcher={item.id}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onSelect}
                    className={navButtonClassName(item.selected)}
                    aria-current={item.selected ? 'page' : undefined}
                    aria-label={item.ariaLabel}
                    data-home-launcher={item.id}
                  >
                    {item.label}
                  </button>
                )
              ))}
            </div>
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-2 xl:ml-auto">
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

        <div className="border-t border-border-muted pt-2">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {backActionHref ? (
                <button
                  type="button"
                  onClick={triggerBackAction}
                  className="ghost-button inline-flex h-8 w-8 items-center justify-center bg-surface text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={backActionLabel}
                >
                  <Icon name="back" size={15} />
                </button>
              ) : null}

              {renameOpen ? (
                <form
                  className="flex min-w-0 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitRename();
                  }}
                >
                  <input
                    ref={renameInputRef}
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenameDraft(placeTitle);
                        setRenameOpen(false);
                      }
                    }}
                    className="ghost-button min-w-56 bg-surface px-3 py-1.5 text-sm font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    aria-label={`Rename ${headerConfig.placeKind ?? 'place'}`}
                  />
                  <button type="submit" className="ghost-button bg-surface px-3 py-1.5 text-xs font-semibold text-primary">
                    Save
                  </button>
                </form>
              ) : (
                <h1 className="line-clamp-1 text-base font-bold text-text" title={placeTitle}>
                  {placeTitle}
                </h1>
              )}

              {canRenamePlace && !renameOpen ? (
                <button
                  type="button"
                  className="ghost-button inline-flex h-8 w-8 items-center justify-center bg-surface text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={`Rename ${placeTitle}`}
                  onClick={() => setRenameOpen(true)}
                >
                  <Icon name="edit" size={15} />
                </button>
              ) : null}

              {placeActions.length > 0 ? (
                <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="ghost-button inline-flex h-8 w-8 items-center justify-center bg-surface text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      aria-label={`${placeTitle} actions`}
                      aria-expanded={actionsOpen}
                    >
                      <Icon name="more" size={16} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 space-y-1 border border-border-muted bg-surface-elevated p-1.5">
                    {placeActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm font-medium text-text hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={action.disabled}
                        onClick={() => {
                          setActionsOpen(false);
                          action.onSelect();
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>

            <div className="min-w-0 xl:w-full xl:max-w-2xl">
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
        </div>
      </div>
    </header>
  );
};
