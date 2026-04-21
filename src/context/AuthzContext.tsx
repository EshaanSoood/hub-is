import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { anonymousUser } from '../data/authzData';
import { getKeycloak, isKeycloakConfigured } from '../lib/keycloak';
import { getMembershipForProject, hasGlobalCapability } from '../lib/policy';
import { buildCurrentAuthRedirectUri, replaceAuthCallbackUrlIfNeeded } from '../services/authRedirect';
import { fetchSessionSummary } from '../services/sessionService';
import type {
  GlobalCapability,
  ProjectCapability,
  ProjectMembership,
  SessionRole,
  SessionSummary,
  UserIdentity,
} from '../types/domain';

interface AuthzContextValue {
  user: UserIdentity;
  sessionSummary: SessionSummary;
  calendarFeedUrl: string;
  signedIn: boolean;
  authReady: boolean;
  keycloakConfigured: boolean;
  authError?: string;
  accessToken?: string;
  globalCapabilities: GlobalCapability[];
  memberships: ProjectMembership[];
  canGlobal: (capability: GlobalCapability) => boolean;
  canProject: (projectId: string, capability: ProjectCapability) => boolean;
  membershipFor: (projectId: string) => ProjectMembership | undefined;
  refreshSession: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const emptySessionSummary: SessionSummary = {
  userId: anonymousUser.id,
  name: anonymousUser.displayName,
  firstName: '',
  lastName: '',
  email: anonymousUser.email,
  role: 'Viewer',
  projectMemberships: [],
  globalCapabilities: [],
  projectCapabilities: {},
  calendarFeedUrl: '',
};

const toUserRole = (role: SessionRole): UserIdentity['role'] => {
  if (role === 'Owner') {
    return 'owner';
  }
  if (role === 'Collaborator') {
    return 'operator';
  }
  return 'viewer';
};

const AuthzContext = createContext<AuthzContextValue | undefined>(undefined);
const E2E_ACCESS_TOKEN_KEY = 'hub:e2e:access-token';
const LOCAL_DEV_BOOTSTRAP_REFRESH_INTERVAL_MS = 2 * 60_000;

const isLocalDevBootstrapEligible = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
};

const readE2eAccessToken = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.localStorage.getItem(E2E_ACCESS_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const clearE2eAccessToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(E2E_ACCESS_TOKEN_KEY);
  } catch {
    // no-op
  }
};

const writeE2eAccessToken = (token: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(E2E_ACCESS_TOKEN_KEY, token);
  } catch {
    // no-op
  }
};

const requestLocalDevBootstrapToken = async (): Promise<string> => {
  const response = await fetch('/api/hub/dev/bootstrap-auth', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => null) as
    | { data?: { access_token?: unknown }; error?: { message?: unknown } }
    | null;
  const accessToken = typeof payload?.data?.access_token === 'string' ? payload.data.access_token.trim() : '';
  if (!response.ok || !accessToken) {
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'Local dev auth bootstrap failed.';
    throw new Error(message);
  }
  writeE2eAccessToken(accessToken);
  return accessToken;
};

export const AuthzProvider = ({ children }: { children: React.ReactNode }) => {
  const keycloakConfigured = isKeycloakConfigured;
  const [authReady, setAuthReady] = useState(!keycloakConfigured);
  const [signedIn, setSignedIn] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(
    keycloakConfigured
      ? undefined
      : 'Keycloak is not configured. Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID.',
  );
  const [sessionSummary, setSessionSummary] = useState<SessionSummary>(emptySessionSummary);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);

  const applyAnonymousState = useCallback((nextAuthError?: string) => {
    setSignedIn(false);
    setSessionSummary(emptySessionSummary);
    setAccessToken(undefined);
    setAuthError(nextAuthError);
  }, []);

  const applyTokenSession = useCallback(async (token: string): Promise<boolean> => {
    try {
      const nextSessionSummary = await fetchSessionSummary(token);
      setSessionSummary(nextSessionSummary);
      setAccessToken(token);
      setSignedIn(true);
      setAuthError(undefined);
      setAuthReady(true);
      return true;
    } catch (error) {
      clearE2eAccessToken();
      applyAnonymousState(error instanceof Error ? error.message : 'Failed to load session from bootstrap token.');
      return false;
    }
  }, [applyAnonymousState]);

  const bootstrapLocalDevSession = useCallback(async (): Promise<boolean> => {
    if (!isLocalDevBootstrapEligible()) {
      return false;
    }
    try {
      const localDevToken = await requestLocalDevBootstrapToken();
      return await applyTokenSession(localDevToken);
    } catch {
      return false;
    }
  }, [applyTokenSession]);

  useEffect(() => {
    const keycloak = getKeycloak();
    let cancelled = false;

    void (async () => {
      const e2eAccessToken = readE2eAccessToken();
      if (e2eAccessToken) {
        const ok = await applyTokenSession(e2eAccessToken);
        if (ok) {
          return;
        }
        if (isLocalDevBootstrapEligible()) {
          const recovered = await bootstrapLocalDevSession();
          if (recovered) {
            return;
          }
        }
      } else if (isLocalDevBootstrapEligible()) {
        const bootstrapped = await bootstrapLocalDevSession();
        if (bootstrapped) {
          return;
        }
      }

      if (!keycloak) {
        setAuthReady(true);
        return;
      }

      const authRedirectUri = buildCurrentAuthRedirectUri(window.location);
      const silentCheckSsoRedirectUri = `${window.location.origin}/silent-check-sso.html`;

      void keycloak
        .init({
          onLoad: 'check-sso',
          checkLoginIframe: false,
          pkceMethod: 'S256',
          responseMode: 'query',
          redirectUri: authRedirectUri,
          silentCheckSsoRedirectUri,
        })
        .then(async (authenticated) => {
          if (cancelled) {
            return;
          }

          if (replaceAuthCallbackUrlIfNeeded(window.history, window.location)) {
            window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
          }

          if (!authenticated || !keycloak.token) {
            applyAnonymousState(undefined);
            setAuthReady(true);
            return;
          }

          try {
            const nextSessionSummary = await fetchSessionSummary(keycloak.token);
            if (cancelled) {
              return;
            }

            setSessionSummary(nextSessionSummary);
            setAccessToken(keycloak.token);
            setSignedIn(true);
            setAuthError(undefined);
            setAuthReady(true);
          } catch (error) {
            if (cancelled) {
              return;
            }

            console.error('Session summary fetch failed', error);
            applyAnonymousState(
              error instanceof Error
                ? error.message
                : 'Authenticated with Keycloak but failed to load hub session from server.',
            );
            setAuthReady(true);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          console.error('Keycloak init failed', error);
          applyAnonymousState('Unable to initialize Keycloak authentication.');
          setAuthReady(true);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAnonymousState, applyTokenSession, bootstrapLocalDevSession]);

  useEffect(() => {
    if (readE2eAccessToken()) {
      if (!signedIn || !isLocalDevBootstrapEligible()) {
        return;
      }

      const refreshLocalDevSession = async () => {
        const recovered = await bootstrapLocalDevSession();
        if (!recovered) {
          applyAnonymousState('Local dev session expired.');
          setAuthReady(true);
        }
      };

      const timerId = window.setInterval(() => {
        void refreshLocalDevSession();
      }, LOCAL_DEV_BOOTSTRAP_REFRESH_INTERVAL_MS);

      return () => {
        window.clearInterval(timerId);
      };
    }

    const keycloak = getKeycloak();
    if (!keycloak || !signedIn || typeof keycloak.updateToken !== 'function' || (!keycloak.authenticated && !keycloak.token)) {
      return;
    }

    const refreshTokenAndSession = async () => {
      if (!keycloak.authenticated && !keycloak.token) {
        return;
      }
      try {
        const refreshed = await keycloak.updateToken(60);
        if (!refreshed || !keycloak.token) {
          return;
        }

        const nextSessionSummary = await fetchSessionSummary(keycloak.token);
        setSessionSummary(nextSessionSummary);
        setAccessToken(keycloak.token);
      } catch (error) {
        console.error('Token/session refresh failed', error);
        applyAnonymousState(undefined);
      }
    };

    const timerId = window.setInterval(() => {
      void refreshTokenAndSession();
    }, 30_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [applyAnonymousState, bootstrapLocalDevSession, signedIn]);

  const user = useMemo<UserIdentity>(
    () => ({
      id: sessionSummary.userId,
      displayName: sessionSummary.name,
      email: sessionSummary.email,
      role: toUserRole(sessionSummary.role),
    }),
    [sessionSummary.email, sessionSummary.name, sessionSummary.role, sessionSummary.userId],
  );

  const memberships = useMemo<ProjectMembership[]>(
    () =>
      sessionSummary.projectMemberships.map((membership) => ({
        id: `membership-${sessionSummary.userId}-${membership.projectId}`,
        userId: sessionSummary.userId,
        projectId: membership.projectId,
        role: membership.membershipRole,
        capabilities: sessionSummary.projectCapabilities[membership.projectId] ?? [],
      })),
    [sessionSummary.projectCapabilities, sessionSummary.projectMemberships, sessionSummary.userId],
  );

  const globalCapabilities = sessionSummary.globalCapabilities;

  const value = useMemo<AuthzContextValue>(
    () => ({
      user,
      sessionSummary,
      calendarFeedUrl: sessionSummary.calendarFeedUrl,
      signedIn,
      authReady,
      keycloakConfigured,
      authError,
      accessToken,
      globalCapabilities,
      memberships,
      canGlobal: (capability) => hasGlobalCapability(sessionSummary.globalCapabilities, capability),
      canProject: (projectId, capability) =>
        (sessionSummary.projectCapabilities[projectId] ?? []).includes(capability),
      membershipFor: (projectId) => getMembershipForProject(memberships, user.id, projectId),
      refreshSession: async () => {
        if (!signedIn) {
          return;
        }

        const token = readE2eAccessToken() || accessToken || getKeycloak()?.token || '';
        if (!token) {
          if (isLocalDevBootstrapEligible()) {
            await bootstrapLocalDevSession();
          }
          return;
        }

        try {
          const nextSessionSummary = await fetchSessionSummary(token);
          setSessionSummary(nextSessionSummary);
          setAccessToken(token);
          setSignedIn(true);
          setAuthError(undefined);
        } catch (error) {
          if (isLocalDevBootstrapEligible()) {
            const recovered = await bootstrapLocalDevSession();
            if (recovered) {
              return;
            }
          }
          setAuthError(error instanceof Error ? error.message : 'Unable to refresh session summary.');
        }
      },
      signIn: async () => {
        const keycloak = getKeycloak();
        if (!keycloak) {
          setAuthError(
            'Keycloak is not configured. Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID.',
          );
          return;
        }

        await keycloak.login({
          redirectUri: buildCurrentAuthRedirectUri(window.location),
        });
      },
      signOut: async () => {
        try {
          window.localStorage.removeItem(E2E_ACCESS_TOKEN_KEY);
        } catch {
          // no-op
        }
        const keycloak = getKeycloak();
        if (!keycloak) {
          setSignedIn(false);
          setSessionSummary(emptySessionSummary);
          setAccessToken(undefined);
          return;
        }

        setSignedIn(false);
        setSessionSummary(emptySessionSummary);
        setAccessToken(undefined);
        await keycloak.logout({
          redirectUri: window.location.origin,
        });
      },
    }),
    [accessToken, authError, authReady, bootstrapLocalDevSession, globalCapabilities, keycloakConfigured, memberships, sessionSummary, signedIn, user],
  );

  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
};

export const useAuthz = (): AuthzContextValue => {
  const context = useContext(AuthzContext);
  if (!context) {
    throw new Error('useAuthz must be used inside AuthzProvider');
  }
  return context;
};
