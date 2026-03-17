import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { appTabs } from '../../lib/policy';
import { useProjects } from '../../context/ProjectsContext';
import { listNotifications, markNotificationRead } from '../../services/hub/notifications';
import type { HubNotification } from '../../services/hub/types';
import { subscribeHubLive } from '../../services/hubLive';
import { buildNotificationDestinationHref } from '../../lib/hubRoutes';

interface ToolbarNotification {
  id: string;
  summary: string;
  body: string;
  authorInitial: string;
  avatarColor: string;
  projectId: string;
  createdAt: string;
  read: boolean;
  payload: Record<string, unknown>;
  href: string;
}

type NotificationFilter = 'unread' | 'all';

const CONTEXTUAL_ACTIONS: Record<string, Array<{ label: string; type: string }>> = {
  calendar: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add event', type: 'event' },
    { label: 'Add reminder', type: 'reminder' },
  ],
  project: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add task to this project', type: 'project-task' },
    { label: 'Add reminder', type: 'reminder' },
  ],
  inbox: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add reminder', type: 'reminder' },
  ],
  other: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add reminder', type: 'reminder' },
  ],
};

const relativeTimeLabel = (iso: string): string => {
  const timestamp = Number(new Date(iso));
  if (!Number.isFinite(timestamp)) {
    return 'just now';
  }
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const deriveContext = (pathname: string): keyof typeof CONTEXTUAL_ACTIONS => {
  if (pathname.includes('/calendar')) {
    return 'calendar';
  }
  if (pathname.includes('/projects')) {
    return 'project';
  }
  return 'other';
};

const buildBreadcrumb = (pathname: string, projects: Array<{ id: string; name: string }>): string[] => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0 || pathname === '/projects' || pathname === '/') {
    return ['Hub Home'];
  }

  if (segments[0] !== 'projects') {
    return segments.map((segment) => segment.replace(/-/g, ' '));
  }

  const crumb: string[] = ['Projects'];
  const projectId = segments[1];
  if (projectId) {
    const projectName = projects.find((project) => project.id === projectId)?.name || projectId;
    crumb.push(projectName);
  }
  if (segments[2]) {
    crumb.push(segments[2].charAt(0).toUpperCase() + segments[2].slice(1));
  }

  return crumb;
};

const NOTIFICATION_AVATAR_COLORS = [
  'rgb(52 124 212)',
  'rgb(46 185 166)',
  'rgb(245 168 80)',
  'rgb(220 80 100)',
  'rgb(132 156 178)',
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const notificationAvatarColor = (value: string): string => {
  const index = hashString(value) % NOTIFICATION_AVATAR_COLORS.length;
  return NOTIFICATION_AVATAR_COLORS[index];
};

const notificationAuthorInitial = (summary: string, fallback: string): string => {
  const source = summary.trim() || fallback.trim();
  const first = source.charAt(0);
  return first ? first.toUpperCase() : '?';
};

const ACCOUNT_AVATAR_BACKGROUNDS = [
  'rgb(40 92 170)',
  'rgb(22 121 107)',
  'rgb(181 103 18)',
  'rgb(164 61 84)',
  'rgb(86 105 125)',
];

const sessionInitials = (name: string, email: string, userId: string): string => {
  const source = name.trim() || email.trim() || userId.trim();
  if (!source) {
    return '?';
  }
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.charAt(0) || ''}${words[1]?.charAt(0) || ''}`.toUpperCase();
  }
  return source.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || source.charAt(0).toUpperCase();
};

const buildAccountAvatarUrl = (initials: string, seed: string): string => {
  const background = ACCOUNT_AVATAR_BACKGROUNDS[hashString(seed || initials) % ACCOUNT_AVATAR_BACKGROUNDS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true"><rect width="64" height="64" rx="32" fill="${background}"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="rgb(255 255 255)" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const isTextInputElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

const toToolbarNotification = (entry: HubNotification): ToolbarNotification => {
  const payloadMessage =
    typeof entry.payload?.message === 'string'
      ? entry.payload.message
      : `Entity ${entry.entity_type}:${entry.entity_id}`;
  return {
    id: entry.notification_id,
    summary: entry.reason,
    body: payloadMessage,
    authorInitial: notificationAuthorInitial(entry.reason, payloadMessage),
    avatarColor: notificationAvatarColor(`${entry.notification_id}:${entry.reason}`),
    projectId: entry.project_id,
    createdAt: entry.created_at,
    read: Boolean(entry.read_at),
    payload: entry.payload || {},
    href: buildNotificationDestinationHref({
      projectId: entry.project_id,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      payload: entry.payload || {},
      fallbackHref: `/projects/${encodeURIComponent(entry.project_id)}/work`,
    }),
  };
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionSummary, canGlobal, accessToken, signOut } = useAuthz();
  const { projects } = useProjects();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('unread');
  const [notifProjectFilter, setNotifProjectFilter] = useState<string | null>(null);
  const [toolbarSearchValue, setToolbarSearchValue] = useState('');
  const [quickNavQuery, setQuickNavQuery] = useState('');
  const [quickNavActiveIndex, setQuickNavActiveIndex] = useState(-1);
  const [notifications, setNotifications] = useState<ToolbarNotification[]>([]);

  const quickNavRef = useRef<HTMLDivElement | null>(null);
  const quickNavInputRef = useRef<HTMLInputElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleTabs = appTabs.filter((tab) => canGlobal(tab.capability));
  const currentContext = deriveContext(location.pathname);
  const breadcrumb = useMemo(
    () => buildBreadcrumb(location.pathname, projects.map((project) => ({ id: project.id, name: project.name }))),
    [location.pathname, projects],
  );

  const refreshNotifications = useCallback(async () => {
    if (!accessToken) {
      return [] as ToolbarNotification[];
    }

    try {
      const next = await listNotifications(accessToken);
      return next.map(toToolbarNotification);
    } catch {
      // best-effort toolbar data
      return null;
    }
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const refreshAndStore = async () => {
      const next = await refreshNotifications();
      if (cancelled || !next) {
        return;
      }
      setNotifications(next);
    };
    const kickoff = window.setTimeout(() => {
      void refreshAndStore();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshAndStore();
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'notification.new') {
        return;
      }
      const nextNotification = toToolbarNotification(message.notification);
      setNotifications((current) => {
        const existingIndex = current.findIndex((notification) => notification.id === nextNotification.id);
        if (existingIndex >= 0) {
          return current.map((notification, index) => (index === existingIndex ? nextNotification : notification));
        }
        return [nextNotification, ...current];
      });
    });
  }, [accessToken]);

  const closeQuickNav = useCallback(() => {
    setQuickNavOpen(false);
    setQuickNavQuery('');
    setQuickNavActiveIndex(-1);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (quickNavOpen && quickNavRef.current && !quickNavRef.current.contains(target)) {
        closeQuickNav();
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (contextMenuOpen && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeQuickNav();
        setProfileOpen(false);
        setNotificationsOpen(false);
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeQuickNav, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen]);

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const quickNavItems = useMemo(() => {
    const tabItems = visibleTabs.map((tab) => ({ id: tab.to, label: tab.label, href: tab.to }));
    const projectItems = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      href: `/projects/${project.id}/overview`,
    }));
    const allItems = [...tabItems, ...projectItems];

    const query = quickNavQuery.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [projects, quickNavQuery, visibleTabs]);

  const normalizedQuickNavActiveIndex =
    quickNavItems.length === 0 || quickNavActiveIndex < 0 || quickNavActiveIndex >= quickNavItems.length
      ? quickNavItems.length === 0
        ? -1
        : 0
      : quickNavActiveIndex;

  useEffect(() => {
    if (!quickNavOpen) {
      return;
    }

    const onQuickNavKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          const nextIndex = current < 0 ? 0 : current + 1;
          return nextIndex >= quickNavItems.length ? 0 : nextIndex;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          if (current <= 0) {
            return quickNavItems.length - 1;
          }
          return current - 1;
        });
        return;
      }

      if (event.key === 'Enter' && normalizedQuickNavActiveIndex >= 0 && quickNavItems[normalizedQuickNavActiveIndex]) {
        event.preventDefault();
        navigate(quickNavItems[normalizedQuickNavActiveIndex].href);
        closeQuickNav();
        return;
      }

      if (event.key.length === 1 && !isTextInputElement(event.target)) {
        event.preventDefault();
        setQuickNavQuery((current) => `${current}${event.key}`);
      }
    };

    document.addEventListener('keydown', onQuickNavKeyDown);
    return () => {
      document.removeEventListener('keydown', onQuickNavKeyDown);
    };
  }, [closeQuickNav, navigate, normalizedQuickNavActiveIndex, quickNavItems, quickNavOpen]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (notifFilter === 'unread' && notification.read) {
        return false;
      }
      if (notifProjectFilter && notification.projectId !== notifProjectFilter) {
        return false;
      }
      return true;
    });
  }, [notifFilter, notifProjectFilter, notifications]);

  const onMarkNotificationRead = async (notificationId: string) => {
    if (!accessToken) {
      return;
    }

    try {
      await markNotificationRead(accessToken, notificationId);
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)),
      );
    } catch {
      const restored = await refreshNotifications();
      if (restored) {
        setNotifications(restored);
      }
    }
  };

  const onNavigateNotification = async (notification: ToolbarNotification) => {
    navigate(notification.href);
    setNotificationsOpen(false);
    if (!notification.read) {
      await onMarkNotificationRead(notification.id);
    }
  };

  const navigateToCapture = (intent: string | null) => {
    const params = new URLSearchParams(location.search);
    params.set('capture', '1');
    if (intent && intent !== 'inbox') {
      params.set('intent', intent);
    } else {
      params.delete('intent');
    }

    const isProjectContext = /^\/projects\/[^/]+/.test(location.pathname) && location.pathname !== '/projects';
    if (isProjectContext) {
      navigate(`${location.pathname}?${params.toString()}`);
      return;
    }

    navigate(`/projects?${params.toString()}`);
  };

  const onQuickAdd = () => {
    navigateToCapture(null);
  };

  const openContextMenu = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    setContextMenuPos({ x: rect.left, y: rect.top - 8 });
    setContextMenuOpen(true);
    setNotificationsOpen(false);
    setProfileOpen(false);
    closeQuickNav();
  };

  const onQuickAddContextual = (type: string) => {
    navigateToCapture(type === 'inbox' ? null : type);
  };

  const accountInitials = sessionInitials(sessionSummary.name, sessionSummary.email, sessionSummary.userId);
  const avatarUrl = buildAccountAvatarUrl(accountInitials, sessionSummary.userId || sessionSummary.email || sessionSummary.name);

  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <header className="sr-only">
        <h1>Hub workspace</h1>
      </header>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <main id="main-content" className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <footer>
        <nav
          aria-label="App toolbar"
          className="relative flex h-12 shrink-0 items-center gap-sm border-t border-border-muted bg-surface-elevated px-md"
        >
        <div className="mr-sm flex min-w-0 items-center gap-xs">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            aria-label="Go home"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 7l6-5 6 5v7H10v-4H6v4H2V7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            </svg>
          </button>

          {breadcrumb.length > 0 ? (
            <span className="truncate text-xs text-muted" aria-label={`Current location: ${breadcrumb.join(' › ')}`}>
              {breadcrumb.join(' › ')}
            </span>
          ) : null}
        </div>

        <div className="relative" ref={quickNavRef}>
          <button
            type="button"
            onClick={() => {
              if (quickNavOpen) {
                closeQuickNav();
              } else {
                setQuickNavOpen(true);
                setQuickNavActiveIndex(quickNavItems.length > 0 ? 0 : -1);
              }
              setProfileOpen(false);
              setNotificationsOpen(false);
              setContextMenuOpen(false);
            }}
            aria-label="Quick navigation"
            aria-expanded={quickNavOpen}
            className="flex h-7 items-center gap-xs rounded-control border border-border-muted px-sm text-[13px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{
              background: quickNavOpen ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Nav
          </button>

          {quickNavOpen ? (
            <div
              role="dialog"
              aria-label="Quick navigation"
              className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-72 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <input
                ref={quickNavInputRef}
                type="search"
                value={quickNavQuery}
                onChange={(event) => {
                  setQuickNavQuery(event.target.value);
                  setQuickNavActiveIndex(0);
                }}
                placeholder="Jump to…"
                aria-label="Navigate to a location"
                className="w-full border-b border-border-muted bg-transparent px-md py-sm text-sm text-text outline-none"
              />
              <ul className="max-h-72 overflow-y-auto py-1">
                {quickNavItems.length === 0 ? (
                  <li className="px-md py-sm text-sm text-muted">No matching destinations</li>
                ) : (
                  quickNavItems.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        style={{
                          background:
                            normalizedQuickNavActiveIndex === index
                              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                              : 'transparent',
                        }}
                        onMouseEnter={() => setQuickNavActiveIndex(index)}
                        onClick={() => {
                          navigate(item.href);
                          closeQuickNav();
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-xs flex-1">
          <input
            type="search"
            value={toolbarSearchValue}
            onChange={(event) => setToolbarSearchValue(event.target.value)}
            placeholder="Search..."
            aria-label="Global search"
            disabled
            title="Global search is not wired yet."
            className="h-7 w-full rounded-control border border-border-muted bg-surface px-sm text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>

        <div className="flex items-center overflow-hidden rounded-control border border-border-muted">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Quick add to inbox"
            className="flex h-7 w-7 items-center justify-center text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Open quick add menu"
            aria-haspopup="menu"
            aria-expanded={contextMenuOpen}
            onClick={(event) => openContextMenu(event.currentTarget)}
            onContextMenu={(event) => {
              event.preventDefault();
              openContextMenu(event.currentTarget);
            }}
            className="flex h-7 w-6 items-center justify-center border-l border-border-muted text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {contextMenuOpen ? (
          <div
            ref={contextMenuRef}
            role="menu"
            className="fixed z-[200] min-w-[180px] rounded-control border border-border-muted bg-surface-elevated py-1 shadow-soft"
            style={{ top: contextMenuPos.y, left: contextMenuPos.x, transform: 'translateY(-100%)' }}
          >
            {(CONTEXTUAL_ACTIONS[currentContext] ?? CONTEXTUAL_ACTIONS.other).map((item) => (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                className="block w-full px-md py-xs text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => {
                  onQuickAddContextual(item.type);
                  setContextMenuOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setProfileOpen(false);
              closeQuickNav();
              setContextMenuOpen(false);
            }}
            aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
            className="relative flex h-9 w-9 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M9 2a5 5 0 00-5 5v3l-1.5 2h13L14 10V7a5 5 0 00-5-5zM7 14a2 2 0 004 0"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {unreadNotifications > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
                style={{ boxShadow: '0 0 0 1.5px var(--color-surface), 0 0 0 3px var(--color-primary)' }}
              />
            ) : null}
          </button>

          {notificationsOpen ? (
            <div
              role="dialog"
              aria-label="Notifications"
              className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-[360px] rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <div className="flex items-center gap-sm border-b border-border-muted px-md py-sm">
                {(['unread', 'all'] as NotificationFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setNotifFilter(filter)}
                    className="text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    style={{
                      fontWeight: notifFilter === filter ? 500 : 400,
                      color: notifFilter === filter ? 'var(--color-text)' : 'var(--color-muted)',
                      borderBottom: notifFilter === filter ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}

                <select
                  value={notifProjectFilter ?? ''}
                  onChange={(event) => setNotifProjectFilter(event.target.value || null)}
                  aria-label="Filter by project"
                  className="ml-auto rounded-control border border-border-muted bg-surface-elevated px-xs py-[2px] text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="max-h-[420px] list-none overflow-y-auto p-0">
                {visibleNotifications.length === 0 ? (
                  <li className="px-xl py-xl text-center text-sm text-muted">
                    {notifFilter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
                  </li>
                ) : (
                  visibleNotifications.map((notification) => (
                    <li
                      key={notification.id}
                      className="group flex items-start gap-sm border-b border-border-muted px-md py-sm last:border-b-0"
                      style={{
                        background: notification.read
                          ? 'transparent'
                          : 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onNavigateNotification(notification)}
                        className="min-w-0 flex flex-1 items-start gap-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <div
                          aria-hidden="true"
                          className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-on-primary"
                          style={{ background: notification.avatarColor }}
                        >
                          {notification.authorInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">{notification.summary}</p>
                          <p className="mt-[2px] line-clamp-2 text-[13px] text-muted">{notification.body}</p>
                        </div>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-xs">
                        <span className="text-xs text-muted" title={new Date(notification.createdAt).toLocaleString()}>
                          {relativeTimeLabel(notification.createdAt)}
                        </span>

                        <div className="flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            aria-disabled="true"
                            aria-label="Add to reminders. Coming soon."
                            title="Coming soon."
                            className="cursor-not-allowed rounded-control border border-border-muted px-2 py-1 text-xs text-muted opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            Add to reminders
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotificationsOpen(false);
              closeQuickNav();
              setContextMenuOpen(false);
            }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="h-7 w-7 overflow-hidden rounded-full border-2 border-transparent bg-muted p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{ borderColor: profileOpen ? 'var(--color-primary)' : 'transparent' }}
          >
            <img src={avatarUrl} alt={sessionSummary.name} className="h-full w-full object-cover" />
          </button>

          {profileOpen ? (
            <div
              role="menu"
              className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-56 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <div className="flex items-center gap-sm border-b border-border-muted px-md py-md">
                <img src={avatarUrl} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{sessionSummary.name}</p>
                  <p className="truncate text-xs text-muted">{sessionSummary.email}</p>
                </div>
              </div>

              <button
                type="button"
                role="menuitem"
                className="block w-full px-md py-sm text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => {
                  navigate('/projects');
                  setProfileOpen(false);
                }}
              >
                Projects
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-md py-sm text-left text-sm text-danger hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => {
                  void signOut();
                  setProfileOpen(false);
                }}
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
        </nav>
      </footer>
    </div>
  );
};
