import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProjectRouteGuard } from './components/auth/ProjectRouteGuard';
import { useAuthz } from './context/AuthzContext';
import { ProjectRouteRedirect } from './components/auth/ProjectRouteRedirect';
import { buildCurrentAuthRedirectUri } from './services/authRedirect';

const ProjectsPage = lazy(async () => {
  const module = await import('./pages/ProjectsPage');
  return { default: module.ProjectsPage };
});

const ProjectSpacePage = lazy(async () => {
  const module = await import('./pages/ProjectSpacePage');
  return { default: module.ProjectSpacePage };
});

const NotFoundPage = lazy(async () => {
  const module = await import('./pages/NotFoundPage');
  return { default: module.NotFoundPage };
});

const RouteLoadingState = ({ label = 'Loading route...' }: { label?: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text" role="status" aria-live="polite">
    <p className="text-sm font-semibold text-primary">{label}</p>
  </div>
);

const App = () => {
  const { signedIn, authReady, signIn } = useAuthz();
  const location = useLocation();
  const navigate = useNavigate();
  const signInCalledRef = useRef(false);
  const previousSignedInRef = useRef(signedIn);
  const signInTimeoutRef = useRef<number | null>(null);
  const [signInError, setSignInError] = useState(false);

  useLayoutEffect(() => {
    if (!authReady) {
      return;
    }

    const cleanedUrl = new URL(buildCurrentAuthRedirectUri({
      origin: window.location.origin,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    }));
    if (
      cleanedUrl.pathname === location.pathname
      && cleanedUrl.search === location.search
      && cleanedUrl.hash === location.hash
    ) {
      return;
    }

    navigate(`${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`, { replace: true });
  }, [authReady, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (previousSignedInRef.current && !signedIn) {
      signInCalledRef.current = false;
    }
    previousSignedInRef.current = signedIn;
  }, [signedIn]);

  useEffect(() => {
    if (!authReady || signedIn || signInCalledRef.current || signInError) {
      return;
    }

    if (signInTimeoutRef.current !== null) {
      window.clearTimeout(signInTimeoutRef.current);
      signInTimeoutRef.current = null;
    }

    signInTimeoutRef.current = window.setTimeout(() => {
      signInTimeoutRef.current = null;
      setSignInError(true);
    }, 10_000);

    signInCalledRef.current = true;
    void signIn().catch(() => {
      setSignInError(true);
    });

    return () => {
      if (signInTimeoutRef.current !== null) {
        window.clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
    };
  }, [authReady, signedIn, signIn, signInError]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text">
        <p className="text-sm font-semibold text-primary">Initializing secure session...</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text">
        {signInError ? (
          <div className="flex flex-col items-center gap-sm text-center" role="alert" aria-live="assertive">
            <p className="text-sm font-semibold text-danger">Unable to reach the sign-in provider.</p>
            <button
              type="button"
              className="rounded-control border border-border-muted px-sm py-xs text-xs font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => {
                if (signInTimeoutRef.current !== null) {
                  window.clearTimeout(signInTimeoutRef.current);
                  signInTimeoutRef.current = null;
                }
                signInCalledRef.current = false;
                setSignInError(false);
              }}
            >
              Retry sign-in
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold text-primary" role="status" aria-live="polite">
            Redirecting to login...
          </p>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route
            path="/projects"
            element={
              <ProtectedRoute capability="projects.view">
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/overview"
            element={
              <ProtectedRoute capability="projects.view">
                <ProjectRouteGuard>
                  <ProjectSpacePage activeTab="overview" />
                </ProjectRouteGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/work/:paneId"
            element={
              <ProtectedRoute capability="projects.view">
                <ProjectRouteGuard>
                  <ProjectSpacePage activeTab="work" />
                </ProjectRouteGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/work"
            element={
              <ProtectedRoute capability="projects.view">
                <ProjectRouteGuard>
                  <ProjectSpacePage activeTab="work" />
                </ProjectRouteGuard>
              </ProtectedRoute>
            }
          />
          <Route path="/projects/:projectId" element={<ProjectRouteRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
};

export default App;
