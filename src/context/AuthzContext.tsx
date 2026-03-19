import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { anonymousUser } from '../data/authzData';
import { getKeycloak, isKeycloakConfigured } from '../lib/keycloak';
import { getMembershipForProject, hasGlobalCapability } from '../lib/policy';
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

  useEffect(() => {
    const e2eAccessToken = readE2eAccessToken();
    if (e2eAccessToken) {
      let cancelled = false;
      void fetchSessionSummary(e2eAccessToken)
        .then((nextSessionSummary) => {
          if (cancelled) {
            return;
          }
          setSessionSummary(nextSessionSummary);
          setAccessToken(e2eAccessToken);
          setSignedIn(true);
          setAuthError(undefined);
          setAuthReady(true);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          clearE2eAccessToken();
          setSignedIn(false);
          setSessionSummary(emptySessionSummary);
          setAccessToken(undefined);
          setAuthError(error instanceof Error ? error.message : 'Failed to load session from bootstrap token.');
          setAuthReady(true);
        });
      return () => {
        cancelled = true;
      };
    }

    const keycloak = getKeycloak();

    if (!keycloak) {
      return;
    }

    let cancelled = false;

    void keycloak
      .init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
        responseMode: 'query',
        redirectUri: window.location.origin,
      })
      .then(async (authenticated) => {
        if (cancelled) {
          return;
        }

        if (!authenticated || !keycloak.token) {
          setSignedIn(false);
          setSessionSummary(emptySessionSummary);
          setAccessToken(undefined);
          setAuthError(undefined);
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
          setSignedIn(false);
          setSessionSummary(emptySessionSummary);
          setAccessToken(undefined);
          setAuthError(
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
        setSignedIn(false);
        setSessionSummary(emptySessionSummary);
        setAccessToken(undefined);
        setAuthError('Unable to initialize Keycloak authentication.');
        setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (readE2eAccessToken()) {
      return;
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
        setSignedIn(false);
        setSessionSummary(emptySessionSummary);
        setAccessToken(undefined);
      }
    };

    const timerId = window.setInterval(() => {
      void refreshTokenAndSession();
    }, 30_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [signedIn]);

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
          return;
        }

        try {
          const nextSessionSummary = await fetchSessionSummary(token);
          setSessionSummary(nextSessionSummary);
          setAccessToken(token);
          setAuthError(undefined);
        } catch (error) {
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
          redirectUri: window.location.origin,
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
    [accessToken, authError, authReady, globalCapabilities, keycloakConfigured, memberships, sessionSummary, signedIn, user],
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
