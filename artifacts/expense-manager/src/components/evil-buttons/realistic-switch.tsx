import React, { useState, useRef, useEffect } from 'react';

export interface RealisticSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  color?: string;
  markColor?: string;
  tone?: 'auto' | 'light' | 'dark';
  illuminated?: boolean;
  sound?: boolean;
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

// ── Web Audio Mechanical Click Synthesizer ──
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playMechanicalClick(isTurningOn: boolean) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Resonant housing thump (tactile body decay)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const startFreq = isTurningOn ? 320 : 260;
    const endFreq = isTurningOn ? 65 : 45;
    const duration = isTurningOn ? 0.038 : 0.028;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isTurningOn ? 3200 : 2600, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    // 2. High-frequency micro-snap contact impulse
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'sine';
    snapOsc.frequency.setValueAtTime(isTurningOn ? 1900 : 1600, now);
    snapOsc.frequency.exponentialRampToValueAtTime(800, now + 0.008);

    snapGain.gain.setValueAtTime(0.22, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);

    snapOsc.start(now);
    snapOsc.stop(now + 0.008);
  } catch {
    // Gracefully ignore audio errors (e.g. strict autoplay policy)
  }
}

// Helper to compute complementary darken/glow colors
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export function RealisticSwitch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  color = '#e1261c',
  markColor = 'white',
  tone = 'auto',
  illuminated = true,
  sound = false,
  size = 'default',
  disabled = false,
  'aria-label': ariaLabel = 'Power',
  className = '',
}: RealisticSwitchProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) {
      setInternalChecked(next);
    }
    if (sound) {
      playMechanicalClick(next);
    }
    onCheckedChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  // Dimensional configuration by size
  const sizeConfig = {
    sm: {
      socket: 'w-10 h-11 p-1 rounded-xl',
      cap: 'w-8 h-9 rounded-lg',
      sunkY: 'translate-y-[3px]',
      unSunkY: 'translate-y-0',
      iconSize: 'w-3.5 h-3.5',
      shadowElevated: '0 4px 0 rgba(0,0,0,0.4), 0 6px 8px rgba(0,0,0,0.45)',
      shadowSunk: '0 1px 0 rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.3)',
    },
    default: {
      socket: 'w-[52px] h-[58px] p-1.5 rounded-2xl',
      cap: 'w-10 h-11 rounded-xl',
      sunkY: 'translate-y-[5px]',
      unSunkY: 'translate-y-0',
      iconSize: 'w-4 h-4',
      shadowElevated: '0 6px 0 rgba(0,0,0,0.45), 0 9px 12px rgba(0,0,0,0.5)',
      shadowSunk: '0 1.5px 0 rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.35)',
    },
    lg: {
      socket: 'w-[68px] h-[76px] p-2 rounded-2xl',
      cap: 'w-[52px] h-[60px] rounded-xl',
      sunkY: 'translate-y-[7px]',
      unSunkY: 'translate-y-0',
      iconSize: 'w-5 h-5',
      shadowElevated: '0 8px 0 rgba(0,0,0,0.48), 0 12px 16px rgba(0,0,0,0.55)',
      shadowSunk: '0 2px 0 rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.4)',
    },
  }[size];

  // Tone bezel finish
  const toneClasses = {
    dark: 'bg-[#121620] border-[#222938] text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),inset_0_-1px_1px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.5)]',
    light: 'bg-[#e5e7eb] border-[#cbd5e1] text-zinc-900 shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_1px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.12)]',
    auto: 'bg-[#e5e7eb] dark:bg-[#121620] border-[#cbd5e1] dark:border-[#222938] text-zinc-900 dark:text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_1px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),inset_0_-1px_1px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.5)]',
  }[tone];

  // Dynamic cap styles & illumination glow
  const isLit = isChecked && illuminated;
  const glowRgba = hexToRgba(color, 0.7);
  const glowRgbaSoft = hexToRgba(color, 0.35);

  const capStyle: React.CSSProperties = {
    backgroundColor: color,
    boxShadow: isChecked
      ? isLit
        ? `${sizeConfig.shadowSunk}, 0 0 16px ${glowRgba}, 0 0 32px ${glowRgbaSoft}, inset 0 0 12px rgba(255,255,255,0.65), inset 0 1px 3px rgba(255,255,255,0.9)`
        : `${sizeConfig.shadowSunk}, inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)`
      : `${sizeConfig.shadowElevated}, inset 0 1px 2px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.35)`,
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex items-center justify-center border select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#fbbf24] ${sizeConfig.socket} ${toneClasses} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {/* Sunken Socket Well Interior */}
      <div className="absolute inset-1 rounded-[inherit] bg-black/40 shadow-[inset_0_3px_8px_rgba(0,0,0,0.85)] pointer-events-none" />

      {/* Raised Latching Switch Cap (Plunger) */}
      <div
        style={capStyle}
        className={`relative z-10 flex items-center justify-center transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${sizeConfig.cap} ${isChecked ? sizeConfig.sunkY : sizeConfig.unSunkY}`}
      >
        {/* Cap Top Translucent Highlight sheen */}
        <div className="absolute inset-x-1 top-0.5 h-[35%] rounded-t-[inherit] bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

        {/* Hot LED Core when illuminated */}
        {isLit && (
          <div
            className="absolute inset-1 rounded-[inherit] bg-gradient-to-tr from-white/20 via-white/50 to-white/10 blur-[1px] pointer-events-none animate-pulse"
            style={{ animationDuration: '3s' }}
          />
        )}

        {/* Power Mark Icon (IEC 5009) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={markColor}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`relative z-20 transition-all duration-150 ${sizeConfig.iconSize} ${isLit ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.95)]' : 'opacity-85'}`}
        >
          {/* Vertical power notch */}
          <line x1="12" y1="3" x2="12" y2="12" />
          {/* Power circle arc */}
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        </svg>
      </div>
    </button>
  );
}
export default RealisticSwitch;
