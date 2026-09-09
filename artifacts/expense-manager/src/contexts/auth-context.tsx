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
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithDemo: (email?: string, name?: string) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  continueAsGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    // Check for local saved user session first
    const savedLocalUser = localStorage.getItem('paisa_auth_user');
    if (savedLocalUser) {
      try {
        const parsed = JSON.parse(savedLocalUser);
        setUser(parsed);
      } catch {
        localStorage.removeItem('paisa_auth_user');
      }
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        getUserProfile(session.user.id).then((p) => {
          if (p) setProfile(p);
          else upsertUserProfile(session.user!).then(setProfile);
        });
      }
      setLoading(false);
    });

    // Listen for Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('paisa_auth_user', JSON.stringify(session.user));
        
        // When signed in or token refreshed, ensure profile exists & record login event
        if (event === 'SIGNED_IN') {
          await recordUserLogin(session.user);
          const p = await upsertUserProfile(session.user);
          if (p) setProfile(p);
        } else {
          getUserProfile(session.user.id).then((p) => {
            if (p) setProfile(p);
          });
        }
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('paisa_auth_user');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      // If keys aren't added, seamlessly log in locally with this account
      signInWithDemo(email, email.split('@')[0]);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      setUser(data.user);
      localStorage.setItem('paisa_auth_user', JSON.stringify(data.user));
      // Record login event in separate table: public.user_logins
      await recordUserLogin(data.user);
      // Sync/upsert profile in separate table: public.profiles
      const p = await upsertUserProfile(data.user);
      if (p) setProfile(p);
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!isSupabaseConfigured) {
      // If keys aren't added, seamlessly register locally
      signInWithDemo(email, fullName || email.split('@')[0]);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (!error && data.user) {
      // Create profile in separate table: public.profiles
      const p = await upsertUserProfile(data.user, fullName);
      if (p) setProfile(p);
      if (data.session) {
        // Record login event in separate table: public.user_logins
        await recordUserLogin(data.user);
      }
    }
    return { error: error as Error | null };
  };

  const signInWithDemo = (email = 'avinandan@paisa.app', name = 'Avinandan Kundu') => {
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
    setProfile({
      id: mockUser.id,
      email: mockUser.email || '',
      full_name: name,
    });
    localStorage.setItem('paisa_auth_user', JSON.stringify(mockUser));
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
    localStorage.removeItem('paisa_auth_user');
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: null };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    return { error: error as Error | null };
  };

  const continueAsGuest = () => {
    signInWithDemo('guest@paisa.app', 'Guest User');
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
