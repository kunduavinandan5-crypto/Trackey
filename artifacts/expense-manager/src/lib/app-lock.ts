// Spendly App Lock & Biometrics Security Service
import {
  saveAppLockSettingsToDb,
  deleteAppLockSettingsFromDb,
  fetchAppLockSettings,
  isRealSupabaseUser,
} from './db-service';
export interface AppLockConfig {
  enabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  biometricEnabled: boolean;
  biometricCredentialId?: string | null;
  autoLockMinutes: number; // 0 = Immediately when app is closed/hidden, 1 = 1 min, 5 = 5 min, 15 = 15 min
}

const CONFIG_KEY = 'spendly_app_lock_config_v1';
const SESSION_UNLOCKED_KEY = 'spendly_app_session_unlocked_v1';
const LAST_ACTIVE_KEY = 'spendly_app_last_active_time_v1';

export function getAppLockConfig(): AppLockConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      return {
        enabled: false,
        pinHash: null,
        pinSalt: null,
        biometricEnabled: false,
        biometricCredentialId: null,
        autoLockMinutes: 0,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      pinHash: parsed.pinHash || null,
      pinSalt: parsed.pinSalt || null,
      biometricEnabled: Boolean(parsed.biometricEnabled),
      biometricCredentialId: parsed.biometricCredentialId || null,
      autoLockMinutes: typeof parsed.autoLockMinutes === 'number' ? parsed.autoLockMinutes : 0,
    };
  } catch {
    return {
      enabled: false,
      pinHash: null,
      pinSalt: null,
      biometricEnabled: false,
      biometricCredentialId: null,
      autoLockMinutes: 0,
    };
  }
}

export function saveAppLockConfig(config: AppLockConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save app lock config', err);
  }
}

// Convert ArrayBuffer to Hex String
function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

// Simple djb2-based fallback hash for HTTP (non-HTTPS) dev environments
function simpleFallbackHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const r1 = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  // second pass with different seed
  let h3 = 0x9e3779b9;
  for (let i = str.length - 1; i >= 0; i--) {
    h3 = Math.imul(h3 ^ str.charCodeAt(i), 2246822519);
  }
  h3 = h3 ^ (h3 >>> 15);
  const r2 = (h3 >>> 0).toString(16).padStart(8, '0');
  return r1 + r2;
}

// Hash PIN with Salt using Web Crypto SHA-256 (falls back to simple hash on HTTP)
export async function hashPin(pin: string, salt: string): Promise<string> {
  const input = `${salt}:${pin}:spendly_secure_lock`;
  // crypto.subtle requires HTTPS (secure context). Fall back gracefully on dev HTTP.
  if (!crypto?.subtle) {
    return simpleFallbackHash(input);
  }
  try {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return buf2hex(hashBuffer);
  } catch {
    return simpleFallbackHash(input);
  }
}

// PIN brute-force protection: 5 wrong attempts => escalating lockout (30s, 1m, 5m, 15m).
const PIN_FAIL_KEY = 'spendly_pin_failures_v1';
const PIN_MAX_FAILS = 5;

function readPinFailState(): { count: number; lockedUntil: number } {
  try {
    const p = JSON.parse(localStorage.getItem(PIN_FAIL_KEY) || '{}');
    return { count: Number(p.count) || 0, lockedUntil: Number(p.lockedUntil) || 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

/** Milliseconds remaining before PIN entry is allowed again (0 = not locked). */
export function getPinLockRemainingMs(): number {
  return Math.max(0, readPinFailState().lockedUntil - Date.now());
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify entered PIN against stored configuration
export async function verifyPin(pin: string): Promise<boolean> {
  const config = getAppLockConfig();
  if (!config.enabled || !config.pinHash || !config.pinSalt) return true;
  if (getPinLockRemainingMs() > 0) return false;
  const hash = await hashPin(pin, config.pinSalt);
  const ok = constantTimeEqual(hash, config.pinHash);
  try {
    if (ok) {
      localStorage.removeItem(PIN_FAIL_KEY);
    } else {
      const count = readPinFailState().count + 1;
      let lockedUntil = 0;
      if (count >= PIN_MAX_FAILS) {
        const step = Math.min(count - PIN_MAX_FAILS, 3);
        lockedUntil = Date.now() + [30_000, 60_000, 300_000, 900_000][step];
      }
      localStorage.setItem(PIN_FAIL_KEY, JSON.stringify({ count, lockedUntil }));
      console.warn('[Security] applock.pin.failed', new Date().toISOString());
    }
  } catch {}
  return ok;
}

// Set up or update the numeric PIN. Pass userId to also sync to Supabase.
export async function setAppPin(pin: string, enableBiometric = false, userId?: string): Promise<void> {
  if (!window.crypto?.getRandomValues) throw new Error('Secure random number generator unavailable.');
  const salt = buf2hex(window.crypto.getRandomValues(new Uint8Array(16)).buffer);
  const pinHash = await hashPin(pin, salt);

  const prev = getAppLockConfig();
  const next: AppLockConfig = {
    ...prev,
    enabled: true,
    pinHash,
    pinSalt: salt,
    biometricEnabled: enableBiometric ? prev.biometricEnabled : false,
  };
  saveAppLockConfig(next);
  setSessionUnlocked(true);

  // Sync to Supabase if user is logged in
  if (userId) {
    saveAppLockSettingsToDb(userId, {
      pin_hash: pinHash,
      pin_salt: salt,
      bio_enabled: next.biometricEnabled,
      auto_lock_min: next.autoLockMinutes,
    }).catch((err) => console.warn('[AppLock] Supabase sync failed on set PIN:', err));
  }
}

// Disable App Lock entirely. Pass userId to also remove row from Supabase.
export function disableAppLock(userId?: string): void {
  saveAppLockConfig({
    enabled: false,
    pinHash: null,
    pinSalt: null,
    biometricEnabled: false,
    biometricCredentialId: null,
    autoLockMinutes: 0,
  });
  sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);

  // Remove from Supabase if user is logged in
  if (userId) {
    deleteAppLockSettingsFromDb(userId).catch((err) =>
      console.warn('[AppLock] Supabase sync failed on disable:', err)
    );
  }
}

// Update just the biometric flag and auto-lock timeout without changing PIN.
export function updateAppLockMeta(
  updates: { biometricEnabled?: boolean; autoLockMinutes?: number },
  userId?: string
): void {
  const prev = getAppLockConfig();
  if (!prev.enabled || !prev.pinHash || !prev.pinSalt) return;
  const next: AppLockConfig = { ...prev, ...updates };
  saveAppLockConfig(next);

  if (userId) {
    saveAppLockSettingsToDb(userId, {
      pin_hash: next.pinHash!,
      pin_salt: next.pinSalt!,
      bio_enabled: next.biometricEnabled,
      auto_lock_min: next.autoLockMinutes,
    }).catch((err) => console.warn('[AppLock] Supabase sync failed on meta update:', err));
  }
}

// Fetch app lock settings from Supabase and synchronize with local storage
export async function syncAppLockFromDb(userId: string): Promise<boolean> {
  if (!isRealSupabaseUser({ id: userId })) return false;
  try {
    const remote = await fetchAppLockSettings(userId);
    if (!remote) return false;
    const current = getAppLockConfig();
    saveAppLockConfig({
      ...current,
      enabled: true,
      pinHash: remote.pin_hash,
      pinSalt: remote.pin_salt,
      biometricEnabled: remote.bio_enabled,
      autoLockMinutes: remote.auto_lock_min,
    });
    return true;
  } catch (err) {
    console.warn('[AppLock] Failed to sync app lock from Supabase:', err);
    return false;
  }
}

// Session state
export function isSessionUnlocked(): boolean {
  const config = getAppLockConfig();
  if (!config.enabled) return true;
  return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
}

export function setSessionUnlocked(unlocked: boolean): void {
  if (unlocked) {
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    recordLastActive();
  } else {
    sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
  }
}

export function lockAppNow(): void {
  sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

export function recordLastActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch { }
}

export function shouldAutoLock(): boolean {
  const config = getAppLockConfig();
  if (!config.enabled) return false;
  if (!isSessionUnlocked()) return true;

  if (config.autoLockMinutes === 0) {
    // Immediate lock upon background / restart
    return false;
  }

  const lastActiveStr = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!lastActiveStr) return true;
  const lastActive = parseInt(lastActiveStr, 10);
  if (isNaN(lastActive)) return true;

  const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);
  return elapsedMinutes >= config.autoLockMinutes;
}

// Check if device supports WebAuthn / Platform Biometrics
export async function isBiometricsSupported(): Promise<boolean> {
  try {
    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
    ) {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Convert Base64 / ArrayBuffer helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Register device biometric via WebAuthn
export async function registerBiometrics(): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return { success: false, error: 'Biometric authenticator is not supported on this browser or connection.' };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Spendly',
        },
        user: {
          id: userId,
          name: 'spendly_user',
          displayName: 'Spendly Account',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false,
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Registration cancelled.' };
    }

    const credentialId = arrayBufferToBase64(credential.rawId);
    const config = getAppLockConfig();
    saveAppLockConfig({
      ...config,
      biometricEnabled: true,
      biometricCredentialId: credentialId,
    });

    return { success: true, credentialId };
  } catch (err: any) {
    console.warn('Biometric registration error:', err);
    return {
      success: false,
      error: err?.message || 'Biometric registration failed. Please ensure your device has a screen lock or fingerprint enabled.',
    };
  }
}

// Authenticate user using device biometric
export async function authenticateBiometrics(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getAppLockConfig();
    if (!config.biometricEnabled) {
      return { success: false, error: 'Biometrics is not enabled in settings.' };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
    };

    if (config.biometricCredentialId) {
      try {
        publicKeyOptions.allowCredentials = [
          {
            id: base64ToArrayBuffer(config.biometricCredentialId),
            type: 'public-key',
          },
        ];
      } catch {
        // Fall back to any resident credential
      }
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    if (assertion) {
      setSessionUnlocked(true);
      return { success: true };
    }

    return { success: false, error: 'Biometric verification did not complete.' };
  } catch (err: any) {
    console.warn('Biometric auth error:', err);
    return {
      success: false,
      error: err?.name === 'NotAllowedError' ? 'Biometric scan was cancelled.' : err?.message || 'Biometric authentication failed.',
    };
  }
}

