import { Suspense, lazy, useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProjectRouteGuard } from './components/auth/ProjectRouteGuard';
import { useAuthz } from './context/AuthzContext';
import { ProjectRouteRedirect } from './components/auth/ProjectRouteRedirect';

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
  const signInCalledRef = useRef(false);

  useEffect(() => {
    if (authReady && !signedIn && !signInCalledRef.current) {
      signInCalledRef.current = true;
      signIn();
    }
  }, [authReady, signedIn, signIn]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text">
        <p className="text-sm font-semibold text-primary">Initializing secure session...</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-primary">Redirecting to login...</p>
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
          <Route
            path="/projects/:projectId/tools"
            element={
              <ProtectedRoute capability="projects.view">
                <ProjectRouteGuard>
                  <ProjectSpacePage activeTab="tools" />
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
