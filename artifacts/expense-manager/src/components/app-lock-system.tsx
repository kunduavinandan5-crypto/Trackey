import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Unlock,
  Fingerprint,
  Delete,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Check,
  X,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  type AppLockConfig,
  getAppLockConfig,
  saveAppLockConfig,
  setAppPin,
  verifyPin,
  disableAppLock,
  isSessionUnlocked,
  setSessionUnlocked,
  lockAppNow,
  recordLastActive,
  shouldAutoLock,
  isBiometricsSupported,
  registerBiometrics,
  authenticateBiometrics,
} from '@/lib/app-lock';

// ── APP LOCK SCREEN (OVERLAY WHEN LOCKED) ──
interface AppLockScreenProps {
  onUnlock: () => void;
  notify?: (message: string, tone?: 'success' | 'danger') => void;
}

export function AppLockScreen({ onUnlock, notify }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [config, setConfig] = useState<AppLockConfig>(getAppLockConfig());
  const biometricAttemptedRef = useRef(false);

  useEffect(() => {
    setConfig(getAppLockConfig());
  }, []);

  const handleBiometricAuth = useCallback(async () => {
    if (!config.biometricEnabled) return;
    setIsVerifying(true);
    setError('');
    try {
      const res = await authenticateBiometrics();
      if (res.success) {
        onUnlock();
      } else if (res.error && res.error !== 'Biometric scan was cancelled.') {
        setError(res.error);
      }
    } catch {
      setError('Biometric authentication failed');
    } finally {
      setIsVerifying(false);
    }
  }, [config.biometricEnabled, onUnlock]);

  // Prompt biometrics once on screen mount if enabled
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (config.enabled && config.biometricEnabled && !biometricAttemptedRef.current) {
      biometricAttemptedRef.current = true;
      timer = setTimeout(() => {
        handleBiometricAuth();
      }, 350);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [config.enabled, config.biometricEnabled, handleBiometricAuth]);

  // Handle PIN submission when 4 digits are entered
  const submitPin = useCallback(
    async (pinToVerify: string) => {
      setIsVerifying(true);
      setError('');
      try {
        const valid = await verifyPin(pinToVerify);
        if (valid) {
          setSessionUnlocked(true);
          onUnlock();
        } else {
          setIsShaking(true);
          setError('Incorrect PIN. Please try again.');
          setTimeout(() => {
            setPin('');
            setIsShaking(false);
          }, 600);
        }
      } catch {
        setError('Verification failed');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [onUnlock]
  );

  const handleKeyPress = (digit: string) => {
    if (isVerifying || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError('');
    if (nextPin.length === 4) {
      submitPin(nextPin);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Enter' && pin.length === 4) {
        submitPin(pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isVerifying, submitPin]);

  return (
    <div
      className="app-lock-screen fixed inset-0 z-[99999] flex flex-col items-center justify-between p-6 select-none"
      style={{
        background: 'linear-gradient(180deg, #090c10 0%, #0d1117 50%, #06090e 100%)',
      }}
    >
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-500/10 to-emerald-500/10 blur-3xl" />
      </div>

      {/* Header section */}
      <div className="relative z-10 flex flex-col items-center text-center pt-8 sm:pt-12">
        <div className="relative mb-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-[#161b22] to-[#21262d] border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <Lock className="h-8 w-8 text-[#fbbf24] animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-[#090c10] flex items-center justify-center">
            <ShieldCheck className="h-3 w-3 text-black stroke-[3]" />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-serif font-extrabold text-white tracking-tight">
          Spendly Locked<span className="text-[#fbbf24]">.</span>
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Enter your 4-digit PIN or use phone biometrics
        </p>

        {/* 4-digit PIN Indicator Dots */}
        <div
          className={`flex items-center justify-center gap-4 my-7 transition-transform ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const filled = pin.length > index;
            return (
              <div
                key={index}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  filled
                    ? 'bg-gradient-to-tr from-[#fbbf24] to-[#f59e0b] scale-110 shadow-[0_0_12px_#fbbf24]'
                    : 'bg-white/10 border border-white/25 scale-100'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-400 animate-fade-in">{error}</p>
        )}
      </div>

      {/* Tactile Keypad */}
      <div className="relative z-10 w-full max-w-xs pb-6">
        <div className="grid grid-cols-3 gap-3.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-14 sm:h-16 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.18] border border-white/10 text-xl font-bold text-white shadow-sm transition active:scale-95 flex items-center justify-center outline-none focus:ring-1 focus:ring-[#fbbf24]"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics button (Bottom Left) */}
          <div className="flex items-center justify-center">
            {config.biometricEnabled ? (
              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={isVerifying}
                title="Use Biometrics (Fingerprint / Face ID)"
                className="h-14 sm:h-16 w-full rounded-2xl bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 active:bg-[#fbbf24]/30 border border-[#fbbf24]/30 text-[#fbbf24] transition active:scale-95 flex items-center justify-center outline-none"
              >
                <Fingerprint className="h-6 w-6 stroke-[2.2]" />
              </button>
            ) : (
              <div className="h-14 sm:h-16 w-full" />
            )}
          </div>

          {/* Zero button (Bottom Middle) */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 sm:h-16 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.18] border border-white/10 text-xl font-bold text-white shadow-sm transition active:scale-95 flex items-center justify-center outline-none focus:ring-1 focus:ring-[#fbbf24]"
          >
            0
          </button>

          {/* Delete / Backspace button (Bottom Right) */}
          <button
            type="button"
            onClick={handleDelete}
            title="Backspace"
            className="h-14 sm:h-16 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.15] border border-white/10 text-neutral-300 transition active:scale-95 flex items-center justify-center outline-none"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SETUP & CHANGE PIN DIALOG ──
interface PinSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notify?: (message: string, tone?: 'success' | 'danger') => void;
}

export function PinSetupDialog({ isOpen, onClose, onSuccess, notify }: PinSetupDialogProps) {
  const [step, setStep] = useState<'create' | 'confirm' | 'biometric'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('create');
      setPin('');
      setConfirmPin('');
      setError('');
      isBiometricsSupported().then(setBiometricSupported);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    setError('');
    if (step === 'create') {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => setStep('confirm'), 200);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next !== pin) {
            setError('PINs do not match. Please try again.');
            setTimeout(() => {
              setConfirmPin('');
              setPin('');
              setStep('create');
            }, 800);
          } else {
            // Success! Move to biometrics prompt if supported, or finish
            if (biometricSupported) {
              setStep('biometric');
            } else {
              completeSetup(false);
            }
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    setError('');
    if (step === 'create') {
      setPin((p) => p.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin((p) => p.slice(0, -1));
    }
  };

  const completeSetup = async (withBiometrics: boolean) => {
    setLoading(true);
    try {
      if (withBiometrics) {
        const reg = await registerBiometrics();
        if (!reg.success) {
          notify?.(reg.error || 'Biometrics could not be registered, PIN lock enabled.', 'danger');
        }
      }
      await setAppPin(pin, withBiometrics);
      notify?.('App Lock activated successfully!', 'success');
      onSuccess();
      onClose();
    } catch {
      setError('Failed to save security settings.');
    } finally {
      setLoading(false);
    }
  };

  const currentVal = step === 'create' ? pin : confirmPin;

  return (
    <div className="app-lock-dialog fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[2rem] bg-[#111317] border border-white/20 p-6 text-white shadow-2xl relative animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'biometric' ? (
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30 shadow-lg">
              <Fingerprint className="h-9 w-9 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Enable Phone Biometrics?</h2>
              <p className="text-xs text-neutral-400 mt-1 px-2">
                Use your Fingerprint or Face ID for fast and secure one-touch unlocking.
              </p>
            </div>

            <div className="flex flex-col w-full gap-2 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => completeSetup(true)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-black font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Yes, Enable Biometrics'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => completeSetup(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold text-xs border border-white/10 transition"
              >
                No, PIN Only
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500/15 text-[#fbbf24] border border-amber-500/25 mb-3">
              <KeyRound className="h-6 w-6" />
            </div>

            <h2 className="text-base font-bold text-white">
              {step === 'create' ? 'Set 4-Digit Security PIN' : 'Confirm Your PIN'}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {step === 'create'
                ? 'Choose a numeric code to secure your financial records'
                : 'Re-enter the same 4-digit code to confirm'}
            </p>

            {/* Dots */}
            <div className="flex items-center gap-3 my-5">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-3.5 w-3.5 rounded-full transition-all ${
                    currentVal.length > idx
                      ? 'bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]'
                      : 'border border-white/30 bg-white/5'
                  }`}
                />
              ))}
            </div>

            {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-lg font-bold text-white transition active:scale-95"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-lg font-bold text-white transition active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-neutral-300 flex items-center justify-center transition active:scale-95"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── APP LOCK SETTINGS CARD (IN SETTINGS / PROFILE TAB) ──
interface AppLockSettingsCardProps {
  notify?: (message: string, tone?: 'success' | 'danger') => void;
  isMobile?: boolean;
}

export function AppLockSettingsCard({ notify, isMobile = false }: AppLockSettingsCardProps) {
  const [config, setConfig] = useState<AppLockConfig>(getAppLockConfig());
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isRegisteringBio, setIsRegisteringBio] = useState(false);

  const refreshConfig = () => {
    setConfig(getAppLockConfig());
  };

  useEffect(() => {
    refreshConfig();
    isBiometricsSupported().then(setBiometricSupported);
  }, []);

  const handleToggleLock = () => {
    if (config.enabled) {
      // Disable lock
      if (window.confirm('Are you sure you want to turn off App Lock?')) {
        disableAppLock();
        refreshConfig();
        notify?.('App Lock turned off.', 'danger');
      }
    } else {
      // Open Setup Dialog
      setIsSetupOpen(true);
    }
  };

  const handleToggleBiometrics = async () => {
    if (!config.enabled) return;
    if (config.biometricEnabled) {
      saveAppLockConfig({
        ...config,
        biometricEnabled: false,
      });
      refreshConfig();
      notify?.('Phone biometrics disabled.', 'danger');
    } else {
      setIsRegisteringBio(true);
      const res = await registerBiometrics();
      setIsRegisteringBio(false);
      if (res.success) {
        refreshConfig();
        notify?.('Phone biometrics enabled successfully!', 'success');
      } else {
        notify?.(res.error || 'Failed to enable biometrics.', 'danger');
      }
    }
  };

  const handleTimeoutChange = (minutes: number) => {
    saveAppLockConfig({
      ...config,
      autoLockMinutes: minutes,
    });
    refreshConfig();
    notify?.('Auto-lock timeout updated.');
  };

  const handleLockNow = () => {
    lockAppNow();
    window.location.reload();
  };

  return (
    <>
      <div className={isMobile ? 'spendly-glass-card space-y-3.5' : 'rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7 space-y-4'}>
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-[#f1f5f3]">App Lock & Biometrics</p>
                {config.enabled ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-500/15 border border-neutral-500/30 px-2 py-0.5 text-[9px] font-bold text-neutral-400">
                    Off
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#9ca3af]">
                Secure app with 4-digit PIN or phone biometrics
              </p>
            </div>
          </div>

          {/* Main Enable / Disable Toggle Switch */}
          <button
            type="button"
            onClick={handleToggleLock}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.enabled ? 'bg-gradient-to-r from-amber-500 to-[#fbbf24]' : 'bg-white/20'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.enabled ? 'translate-x-5 bg-neutral-900' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Enabled Sub-options */}
        {config.enabled && (
          <div className="space-y-3 pt-2 border-t border-white/10 text-xs">
            {/* Phone Biometrics Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-[#fbbf24]" />
                <div>
                  <p className="font-semibold text-white">Phone Biometrics</p>
                  <p className="text-[10px] text-neutral-400">
                    {biometricSupported
                      ? 'Unlock using Fingerprint or Face ID'
                      : 'Device biometrics unavailable or requires HTTPS'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={!biometricSupported || isRegisteringBio}
                onClick={handleToggleBiometrics}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.biometricEnabled ? 'bg-[#fbbf24]' : 'bg-white/20'
                } ${!biometricSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.biometricEnabled ? 'translate-x-4 bg-neutral-900' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto-Lock Timeout Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#fbbf24]" />
                <div>
                  <p className="font-semibold text-white">Auto-Lock Timer</p>
                  <p className="text-[10px] text-neutral-400">Lock app when backgrounded</p>
                </div>
              </div>

              <div className="relative">
                <select
                  value={config.autoLockMinutes}
                  onChange={(e) => handleTimeoutChange(Number(e.target.value))}
                  className="appearance-none rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-2.5 py-1 pr-6 text-[11px] font-bold text-[#fde68a] outline-none"
                >
                  <option value={0} className="bg-[#0b0f19] text-[#f1f5f3]">
                    Immediately
                  </option>
                  <option value={1} className="bg-[#0b0f19] text-[#f1f5f3]">
                    After 1 min
                  </option>
                  <option value={5} className="bg-[#0b0f19] text-[#f1f5f3]">
                    After 5 mins
                  </option>
                  <option value={15} className="bg-[#0b0f19] text-[#f1f5f3]">
                    After 15 mins
                  </option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-[#fbbf24]" />
              </div>
            </div>

            {/* Action Buttons: Change PIN & Lock Now */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSetupOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#182033] border border-[#fbbf24]/30 py-2 px-3 text-[11px] font-bold text-[#fde68a] transition active:scale-95 hover:bg-[#202942]"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#fbbf24]" />
                <span>Change PIN</span>
              </button>

              <button
                type="button"
                onClick={handleLockNow}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] py-2 px-3 text-[11px] font-bold text-[#080c14] shadow-[0_0_10px_rgba(245,158,11,0.25)] transition active:scale-95"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Lock Now</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup / Change PIN Dialog */}
      <PinSetupDialog
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onSuccess={() => refreshConfig()}
        notify={notify}
      />
    </>
  );
}
