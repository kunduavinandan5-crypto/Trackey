import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  recordUserLogin,
  upsertUserProfile,
  getUserProfile,
  type DbProfile,
  isRealSupabaseUser,
} from '@/lib/db-service';

interface AuthContextType {
  user: User | null;
  profile: DbProfile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isGuest: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>;
  signInWithDemo: (email?: string, name?: string) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  continueAsGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'spendly_auth_user';
const LEGACY_AUTH_USER_KEY = 'paisa_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  const refreshProfile = async () => {
    if (!user || !isRealSupabaseUser(user)) return;
    const p = await getUserProfile(user.id);
    if (p) setProfile(p);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const savedLocalUser = localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(LEGACY_AUTH_USER_KEY);
      if (savedLocalUser) {
        try {
          const parsed = JSON.parse(savedLocalUser);
          setUser(parsed);
          setIsGuest(true);
        } catch {
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem(LEGACY_AUTH_USER_KEY);
        }
      }
      setLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial Session Check from Supabase Client
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          setIsGuest(false);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(initialSession.user));
          getUserProfile(initialSession.user.id)
            .then((p) => {
              if (isMounted) {
                if (p) setProfile(p);
                else upsertUserProfile(initialSession.user!).then((up) => isMounted && setProfile(up));
              }
            })
            .catch(() => {});
        } else {
          // Check if user was in guest mode
          const savedLocal = localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(LEGACY_AUTH_USER_KEY);
          if (savedLocal) {
            try {
              const parsed = JSON.parse(savedLocal);
              if (parsed && !isRealSupabaseUser(parsed)) {
                setUser(parsed);
                setIsGuest(true);
              }
            } catch {}
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Listen to real-time Auth State Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setIsGuest(false);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentSession.user));

          try {
            if (event === 'SIGNED_IN') {
              await recordUserLogin(currentSession.user);
              const p = await upsertUserProfile(currentSession.user);
              if (isMounted && p) setProfile(p);
            } else {
              const p = await getUserProfile(currentSession.user.id);
              if (isMounted && p) setProfile(p);
            }
          } catch (err) {
            console.warn('[Supabase] Auth state profile/login warning:', err);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsGuest(false);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(LEGACY_AUTH_USER_KEY);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      signInWithDemo(email, email.split('@')[0]);
      return { error: null };
    }
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (!error && data.user) {
      setUser(data.user);
      if (data.session) setSession(data.session);
      setIsGuest(false);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      try {
        await recordUserLogin(data.user);
        const p = await upsertUserProfile(data.user);
        if (p) setProfile(p);
      } catch (err) {
        console.warn('[Supabase] Login tracking warning:', err);
      }
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!isSupabaseConfigured) {
      signInWithDemo(email, fullName || email.split('@')[0]);
      return { data: null, error: null };
    }
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: fullName ? { data: { full_name: fullName.trim() } } : undefined,
    });
    if (!error && data.user) {
      try {
        const p = await upsertUserProfile(data.user, fullName);
        if (p) setProfile(p);
        if (data.session) {
          setUser(data.user);
          setSession(data.session);
          setIsGuest(false);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          await recordUserLogin(data.user);
        }
      } catch (err) {
        console.warn('[Supabase] Signup profile tracking warning:', err);
      }
    }
    return { data, error: error as Error | null };
  };

  const resendVerificationEmail = async (email: string) => {
    if (!isSupabaseConfigured) return { error: null };
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });
    return { error: error as Error | null };
  };

  const signInWithDemo = (email = 'avinandan@spendly.app', name = 'Avinandan Kundu') => {
    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: name },
      aud: 'authenticated',
      confirmation_sent_at: '',
      recovery_sent_at: '',
      email_change_sent_at: '',
      new_email: '',
      invited_at: '',
      action_link: '',
      email,
      phone: '',
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
      phone_confirmed_at: '',
      last_sign_in_at: new Date().toISOString(),
      role: 'authenticated',
      updated_at: new Date().toISOString(),
      identities: [],
      factors: [],
    };
    setUser(mockUser);
    setIsGuest(true);
    setProfile({
      id: mockUser.id,
      email: mockUser.email || '',
      full_name: name,
    });
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(mockUser));
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore network error on signout
      }
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsGuest(false);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(LEGACY_AUTH_USER_KEY);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: null };
    }
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    return { error: error as Error | null };
  };

  const continueAsGuest = () => {
    signInWithDemo('guest@spendly.app', 'Guest User');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        isGuest,
        signInWithPassword,
        signUp,
        signInWithDemo,
        signOut,
        resetPassword,
        resendVerificationEmail,
        continueAsGuest,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
