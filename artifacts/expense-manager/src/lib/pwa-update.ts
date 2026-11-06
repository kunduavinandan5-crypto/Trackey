import { registerSW } from 'virtual:pwa-register';

export const APP_VERSION = 'v1.6.1';

export interface PwaStatus {
  isChecking: boolean;
  hasUpdate: boolean;
  lastChecked: string | null;
}

type Listener = (status: PwaStatus) => void;
const listeners = new Set<Listener>();

let currentStatus: PwaStatus = {
  isChecking: false,
  hasUpdate: false,
  lastChecked: null,
};

let swRegistration: ServiceWorkerRegistration | null = null;
let updateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

function emit() {
  listeners.forEach((fn) => fn({ ...currentStatus }));
}

export function subscribePwa(fn: Listener) {
  listeners.add(fn);
  fn({ ...currentStatus });
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Initializes Service Worker registration and auto-update listeners.
 */
export function initPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // In development, unregister any existing service workers to avoid reload loops
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    return;
  }

  // When a new SW activates and takes control, reload once to ensure all assets are updated
  let reloadPending = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadPending) {
      reloadPending = true;
      console.log('[PWA] Controller changed: auto-reloading to newest version...');
      window.location.reload();
    }
  });

  updateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New version detected!');
      currentStatus = { ...currentStatus, hasUpdate: true };
      emit();
      // Auto-activate immediately
      if (updateFn) {
        updateFn(true);
      }
    },
    onOfflineReady() {
      console.log('[PWA] Ready to work offline');
    },
    onRegisteredSW(swUrl, r) {
      console.log('[PWA] Service worker registered:', swUrl);
      if (r) {
        swRegistration = r;
        currentStatus = { ...currentStatus, lastChecked: new Date().toLocaleTimeString() };
        emit();

        // 1. Check immediately on launch
        r.update().catch((err) => console.warn('[PWA] Immediate update check failed:', err));

        // 2. Check whenever user resumes / returns to the app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(() => {});
            currentStatus = { ...currentStatus, lastChecked: new Date().toLocaleTimeString() };
            emit();
          }
        });

        window.addEventListener('focus', () => {
          r.update().catch(() => {});
        });

        // 3. Periodic check every 30 seconds
        setInterval(() => {
          r.update().catch(() => {});
        }, 30 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] Registration error:', err);
    },
  });
}

/**
 * Manually check for updates from the server.
 */
export async function checkForAppUpdates(): Promise<{ updated: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { updated: false, message: 'Service worker not supported on this device.' };
  }

  currentStatus = { ...currentStatus, isChecking: true };
  emit();

  try {
    const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
    if (reg) {
      await reg.update();
      currentStatus = {
        ...currentStatus,
        isChecking: false,
        lastChecked: new Date().toLocaleTimeString(),
      };
      emit();

      if (reg.waiting || reg.installing) {
        if (updateFn) await updateFn(true);
        else window.location.reload();
        return { updated: true, message: 'New version found! Reloading...' };
      }
    }

    currentStatus = {
      ...currentStatus,
      isChecking: false,
      lastChecked: new Date().toLocaleTimeString(),
    };
    emit();
    return { updated: false, message: 'Your app is already up to date!' };
  } catch (err) {
    currentStatus = { ...currentStatus, isChecking: false };
    emit();
    return { updated: false, message: 'Unable to check for updates right now.' };
  }
}

/**
 * Hard force-refresh: Purges all browser caches and unregisters workers, then reloads fresh.
 */
export async function forceAppRefresh(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (err) {
    console.warn('[PWA] Error purging cache:', err);
  } finally {
    // Bust cache on reload
    window.location.href = window.location.origin + window.location.pathname + '?ts=' + Date.now();
  }
}
