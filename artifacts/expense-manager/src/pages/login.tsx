import { useState, useEffect, type FormEvent } from 'react';
import { useLocation, Link } from 'wouter';
import {
  ReceiptIndianRupee,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isRealSupabaseUser } from '@/lib/db-service';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isConfigured, signInWithPassword, signUp, resetPassword, continueAsGuest } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already logged in with a real Supabase user, redirect home
  useEffect(() => {
    if (user && isRealSupabaseUser(user)) {
      setLocation('/');
    }
  }, [user, setLocation]);

  if (user && isRealSupabaseUser(user)) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
        setLocation('/');
      } else if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        setSuccessMessage('Account created! Please check your email to confirm your account, or sign in.');
        setMode('signin');
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccessMessage('Password reset link sent to your email address.');
        setMode('signin');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    continueAsGuest();
    setLocation('/');
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-8">
      {/* ── SPENDLY MOBILE LOGIN UI (strictly for phone users < 640px) ── */}
      <div className="w-full max-w-sm sm:hidden my-auto">
        {user && (
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLocation('/settings')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4ade80] bg-[#11241a] border border-[#34d399]/25 px-3 py-1.5 rounded-full transition active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Settings</span>
            </button>
          </div>
        )}
        {/* Top App Logo Badge */}
        <div className="flex justify-center mb-3">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 p-1.5 shadow-2xl ring-1 ring-emerald-500/25 transition-transform hover:scale-105">
            <img
              src="/logo.png"
              alt="Spendly Logo"
              className="h-full w-full rounded-xl object-contain shadow-md"
            />
          </div>
        </div>

        {/* Brand Heading */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-display font-extrabold tracking-tight text-white">
            spendly<span className="text-[#4ade80]">.</span>
          </h1>
          <p className="text-xs text-[#7d9688] mt-0.5 font-medium">Smart money, smarter life</p>
        </div>

        {/* Success / Error Banners */}
        {successMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/60 p-3.5 text-xs text-emerald-300 backdrop-blur-md">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-950/60 p-3.5 text-xs text-rose-300 backdrop-blur-md">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Mobile Glass Card Form */}
        <div className="spendly-glass-card p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4ade80]/70" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-2xl border border-[#22c55e]/25 bg-[#0a1610]/80 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-[#5a7364] outline-none transition focus:border-[#4ade80] focus:ring-2 focus:ring-[#4ade80]/20"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4ade80]/70" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Alex@gmail.com"
                className="w-full rounded-2xl border border-[#22c55e]/25 bg-[#0a1610]/80 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-[#5a7364] outline-none transition focus:border-[#4ade80] focus:ring-2 focus:ring-[#4ade80]/20"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4ade80]/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-2xl border border-[#22c55e]/25 bg-[#0a1610]/80 py-3 pl-11 pr-11 text-sm font-medium text-white placeholder:text-[#5a7364] outline-none transition focus:border-[#4ade80] focus:ring-2 focus:ring-[#4ade80]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7d9688] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'signin' && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                      }}
                      className="text-xs font-semibold text-[#4ade80] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Neon Green Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="spendly-neon-btn mt-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#042413] border-t-transparent" />
              ) : (
                <span>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 text-center">
            <span className="text-[11px] font-semibold text-[#5a7364]">
              • or continue with •
            </span>
          </div>

          {/* Demo / Guest / Google Pill Button */}
          <button
            type="button"
            onClick={handleGuestMode}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#22c55e]/20 bg-[#0a1610]/90 py-3 text-xs font-bold text-white transition hover:bg-[#12241b] active:scale-[0.98]"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-black font-extrabold text-[10px]">
              G
            </span>
            <span>Continue with Google / Demo</span>
          </button>
        </div>

        {/* Footer switch */}
        <div className="mt-6 text-center text-xs text-[#7d9688]">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="font-bold text-[#4ade80] hover:underline"
              >
                Sign up free
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="font-bold text-[#4ade80] hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── DESKTOP LOGIN UI (preserved for sm+ screens) ── */}
      <div className="relative hidden w-full max-w-md sm:block">
        {/* Glow halo behind card */}
        <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-70 blur-xl transition-all duration-500" />

        <div className="relative rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
          {user && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setLocation('/settings')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Settings</span>
              </button>
            </div>
          )}
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 transition-transform hover:scale-105"
            >
              <img
                src="/logo.png"
                alt="Spendly Logo"
                className="h-14 w-14 rounded-2xl object-contain shadow-lg"
              />
              <span className="font-display text-2xl font-bold tracking-tight">
                spendly<span className="text-accent">.</span>
              </span>
            </Link>

            <h1 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h1>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              {mode === 'signin' && 'Sign in to access your synced personal expenses'}
              {mode === 'signup' && 'Track your monthly finances securely across devices'}
              {mode === 'forgot' && 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Setup notice if Supabase credentials are missing */}
          {!isConfigured && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Supabase Keys Required</p>
                  <p className="mt-1 leading-relaxed opacity-90">
                    Add your <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">VITE_SUPABASE_URL</code> and{' '}
                    <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">VITE_SUPABASE_ANON_KEY</code> to{' '}
                    <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">.env</code> to connect live authentication.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab Switcher: Sign In vs Sign Up */}
          {mode !== 'forgot' && (
            <div className="mt-6 grid grid-cols-2 rounded-full border border-border/80 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`rounded-full py-2 text-xs font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`rounded-full py-2 text-xs font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">Full Name</label>
                <div className="relative mt-1.5">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Avinandan Kundu"
                    className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Email Address</label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-muted-foreground">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Link'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Back button for Forgot Password */}
          {mode === 'forgot' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                &larr; Back to Sign In
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Or
            </span>
          </div>

          {/* Guest / Offline Mode Button */}
          <button
            type="button"
            onClick={handleGuestMode}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-bold text-primary transition-all hover:bg-primary/20 active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Try Demo / Continue as Guest</span>
          </button>

          {/* Privacy & Supabase Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Secured with Supabase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
