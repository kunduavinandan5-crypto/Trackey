import { useState, type FormEvent } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

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

  // If already logged in, redirect home
  if (user) {
    setLocation('/');
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
    <div className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 py-8">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.7) 0%, hsl(var(--accent) / 0.4) 60%, transparent 80%)',
        }}
        aria-hidden="true"
      />

      {/* Main Card Container */}
      <div className="relative w-full max-w-md">
        {/* Glow halo behind card */}
        <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-70 blur-xl transition-all duration-500" />

        <div className="relative rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 transition-transform hover:scale-105"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-foreground shadow-md">
                <ReceiptIndianRupee className="h-6 w-6" />
              </span>
              <span className="font-display text-2xl font-bold tracking-tight">
                paisa<span className="text-accent">.</span>
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
              {mode === 'forgot' && "Enter your email to receive a password reset link"}
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/30 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-muted/70 active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Continue as Guest (Offline Mode)</span>
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
