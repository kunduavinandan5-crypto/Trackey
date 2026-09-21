import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Register PWA Service Worker in production only (avoids dev reload loops)
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // autoUpdate: vite-plugin-pwa will call skipWaiting() automatically.
  // When the new SW takes control (controllerchange), reload all tabs so
  // users instantly get the latest version without manually refreshing.
  let reloadPending = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadPending) {
      reloadPending = true;
      window.location.reload();
    }
  });

  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      // Check for updates every 60 seconds while the app is open
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
  });
} else if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}
// Lock zoom and prevent accidental pinch/gesture/double-tap zooming on mobile
if (typeof window !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false },
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
