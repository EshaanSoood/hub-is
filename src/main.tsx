import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/primitives';
import { ActivityProvider } from './context/ActivityContext';
import { AuthzProvider } from './context/AuthzContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { SmartWakeProvider } from './context/SmartWakeContext';
import '../tokens.css';
import '../globals.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthzProvider>
      <ProjectsProvider>
        <SmartWakeProvider>
          <ActivityProvider>
            <App />
            <ToastProvider />
          </ActivityProvider>
        </SmartWakeProvider>
      </ProjectsProvider>
    </AuthzProvider>
  </BrowserRouter>,
);
