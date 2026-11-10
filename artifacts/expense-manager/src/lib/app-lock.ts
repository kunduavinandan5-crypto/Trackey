// Spendly App Lock & Biometrics Security Service
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

// Hash PIN with Salt using Web Crypto SHA-256
export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}:spendly_secure_lock`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(hashBuffer);
}

// Verify entered PIN against stored configuration
export async function verifyPin(pin: string): Promise<boolean> {
  const config = getAppLockConfig();
  if (!config.enabled || !config.pinHash || !config.pinSalt) return true;
  const hash = await hashPin(pin, config.pinSalt);
  return hash === config.pinHash;
}

// Set up or update the numeric PIN
export async function setAppPin(pin: string, enableBiometric = false): Promise<void> {
  const salt = window.crypto?.getRandomValues
    ? buf2hex(window.crypto.getRandomValues(new Uint8Array(16)).buffer)
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
  const pinHash = await hashPin(pin, salt);

  const prev = getAppLockConfig();
  saveAppLockConfig({
    ...prev,
    enabled: true,
    pinHash,
    pinSalt: salt,
    biometricEnabled: enableBiometric ? prev.biometricEnabled : false,
  });
  setSessionUnlocked(true);
}

// Disable App Lock entirely
export function disableAppLock(): void {
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
  } catch {}
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
