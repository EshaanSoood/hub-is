import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const devProxyTarget = (process.env.VITE_DEV_PROXY_TARGET || process.env.HUB_BASE_URL || 'http://127.0.0.1:3001').trim();

const manualVendorChunk = (id: string): string | undefined => {
  if (!id.includes('/node_modules/')) {
    return undefined;
  }

  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor';
  }

  if (id.includes('/node_modules/react-router/') || id.includes('/node_modules/react-router-dom/')) {
    return 'router-vendor';
  }

  if (id.includes('/node_modules/keycloak-js/')) {
    return 'auth-vendor';
  }

  if (
    id.includes('/node_modules/@radix-ui/') ||
    id.includes('/node_modules/@floating-ui/') ||
    id.includes('/node_modules/cmdk/') ||
    id.includes('/node_modules/sonner/') ||
    id.includes('/node_modules/react-remove-scroll') ||
    id.includes('/node_modules/react-remove-scroll-bar') ||
    id.includes('/node_modules/react-style-singleton') ||
    id.includes('/node_modules/use-callback-ref') ||
    id.includes('/node_modules/use-sidecar') ||
    id.includes('/node_modules/aria-hidden')
  ) {
    return 'ui-vendor';
  }

  return undefined;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: manualVendorChunk,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
