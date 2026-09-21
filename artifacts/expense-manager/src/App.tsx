import { type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Banknote,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Database,
  Edit3,
  FileDown,
  Film,
  Filter,
  Gauge,
  GraduationCap,
  HeartPulse,
  Home as HomeIcon,
  Landmark,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Receipt,
  ReceiptIndianRupee,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User as UserIcon,
  UserCog,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import LoginPage from '@/pages/login';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { ReportCharts } from '@/components/report-charts';
import { exportMonthlyExpensePdf } from '@/lib/pdf-report';
import {
  saveExpenseToDb,
  deleteExpenseFromDb,
  fetchUserExpenses,
  fetchUserSalaries,
  saveSalaryToDb,
  isRealSupabaseUser,
} from '@/lib/db-service';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  notes: string;
};

type FinanceStore = {
  expenses: Expense[];
  salaries: Record<string, number>;
  categories?: string[];
  customCategories?: string[];
};

const STORAGE_KEY = 'spendly-pocket-finance-v1';
const LEGACY_STORAGE_KEY = 'paisa-pocket-finance-v1';
const THEME_KEY = 'spendly-theme-preference';
const LEGACY_THEME_KEY = 'paisa-theme-preference';
const BASE_CATEGORIES = ['Food', 'Rent', 'Travel', 'Shopping', 'Bills', 'Education', 'Health', 'Entertainment', 'Work', 'Other'];
const CATEGORY_COLORS = ['#6366f1', '#e18562', '#d3a53c', '#6f567a', '#4f9a9d', '#d77e99', '#739359', '#bb7650', '#53749b', '#9c8b6e'];

const monthKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));

const rupees = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(amount));

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning! ☀️';
  if (hour < 17) return 'Good afternoon! 🌤️';
  return 'Good evening! 🌙';
}

function getCategoryIcon(category: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('grocer') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('tea') || cat.includes('coffee')) {
    return UtensilsCrossed;
  }
  if (cat.includes('transport') || cat.includes('travel') || cat.includes('cab') || cat.includes('fuel') || cat.includes('auto') || cat.includes('metro') || cat.includes('car')) {
    return Car;
  }
  if (cat.includes('shop') || cat.includes('cloth') || cat.includes('mall') || cat.includes('amazon') || cat.includes('flipkart')) {
    return ShoppingBag;
  }
  if (cat.includes('health') || cat.includes('medic') || cat.includes('doctor') || cat.includes('pharmacy') || cat.includes('hospital')) {
    return HeartPulse;
  }
  if (cat.includes('entertainment') || cat.includes('movie') || cat.includes('cinema') || cat.includes('netflix') || cat.includes('game') || cat.includes('music')) {
    return Film;
  }
  if (cat.includes('bill') || cat.includes('electric') || cat.includes('wifi') || cat.includes('recharge') || cat.includes('rent') || cat.includes('utility')) {
    return Receipt;
  }
  if (cat.includes('educat') || cat.includes('course') || cat.includes('book') || cat.includes('tuition') || cat.includes('school') || cat.includes('college')) {
    return GraduationCap;
  }
  if (cat.includes('work') || cat.includes('office') || cat.includes('business')) {
    return Briefcase;
  }
  if (cat.includes('salary') || cat.includes('income') || cat.includes('bonus') || cat.includes('deposit')) {
    return Wallet;
  }
  return CreditCard;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const fallbackStore: FinanceStore = { expenses: [], salaries: {}, categories: [...BASE_CATEGORIES], customCategories: [] };

function getStoreStorageKey(userId?: string | null): string {
  if (userId && isRealSupabaseUser({ id: userId })) {
    return `spendly-store-user-${userId}`;
  }
  return 'spendly-store-guest';
}

function parseStore(raw: string): FinanceStore {
  try {
    const parsed = JSON.parse(raw) as Partial<FinanceStore>;
    let cats: string[] = [];
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      cats = parsed.categories;
    } else {
      const custom = Array.isArray(parsed.customCategories) ? parsed.customCategories : [];
      const combined = [...BASE_CATEGORIES];
      custom.forEach((c) => {
        if (!combined.includes(c)) combined.push(c);
      });
      cats = combined;
    }
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      salaries: parsed.salaries && typeof parsed.salaries === 'object' ? parsed.salaries : {},
      categories: cats,
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    };
  } catch {
    return fallbackStore;
  }
}

function findExistingLegacyStore(): FinanceStore | null {
  // Only migrate from truly legacy app keys — never from guest store
  const legacyKeys = [
    'spendly-pocket-finance-v1',
    'paisa-pocket-finance-v1',
    'paisa_finance_store',
    'finance_store',
  ];
  for (const k of legacyKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = parseStore(raw);
        if (parsed.expenses.length > 0 || Object.keys(parsed.salaries).length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

function loadStore(userId?: string | null): FinanceStore {
  try {
    const key = getStoreStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = parseStore(raw);
      if (parsed.expenses.length > 0 || Object.keys(parsed.salaries).length > 0) {
        return parsed;
      }
    }
    // Check all legacy keys to recover existing records
    const legacy = findExistingLegacyStore();
    if (legacy) {
      localStorage.setItem(key, JSON.stringify(legacy));
      return legacy;
    }
    return fallbackStore;
  } catch {
    return fallbackStore;
  }
}

// Custom hook for theme management (Light / Dark)
function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
}

function useFinance() {
  const { user } = useAuth();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Initialize from user-specific localStorage immediately to avoid blank flicker on refresh.
  // We read the persisted auth user key directly so we don't have to wait for auth to resolve.
  const [store, setStore] = useState<FinanceStore>(() => {
    if (typeof window === 'undefined') return fallbackStore;
    try {
      // Try to read the saved auth user (set by auth-context on every login)
      const savedUserRaw = localStorage.getItem('spendly_auth_user');
      if (savedUserRaw) {
        const savedUser = JSON.parse(savedUserRaw) as { id?: string };
        if (savedUser?.id && isRealSupabaseUser(savedUser as { id: string })) {
          // Real Supabase user — load their own store
          const userRaw = localStorage.getItem(`spendly-store-user-${savedUser.id}`);
          if (userRaw) return parseStore(userRaw);
          return fallbackStore;
        }
      }
      // Guest / no user — load guest store
      const guestRaw = localStorage.getItem('spendly-store-guest');
      if (guestRaw) return parseStore(guestRaw);
    } catch {}
    return fallbackStore;
  });

  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'danger' } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Ref to suppress realtime events triggered by our OWN local writes
  const localChangePendingRef = useRef<number>(0);
  // Debounce timer for realtime events
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = getStoreStorageKey(user?.id);
    localStorage.setItem(key, JSON.stringify(store));
  }, [store, user?.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const categories = store.categories && store.categories.length > 0 ? store.categories : BASE_CATEGORIES;
  const notify = (message: string, kind: 'success' | 'danger' = 'success') => setToast({ message, kind });

  // Sync with Supabase on login or user switch
  useEffect(() => {
    if (!user || !isRealSupabaseUser(user)) {
      // Guest mode: load guest-specific local store
      try {
        const raw = localStorage.getItem('spendly-store-guest');
        if (raw) setStore(parseStore(raw));
        else setStore(fallbackStore);
      } catch {
        setStore(fallbackStore);
      }
      prevUserIdRef.current = null;
      return;
    }

    const userId = user.id;
    const userChanged = prevUserIdRef.current !== userId;
    prevUserIdRef.current = userId;

    let cancelled = false;

    const loadSupabaseData = async (source: 'initial' | 'realtime' = 'realtime') => {
      // Skip realtime-triggered refetch if we just made a local change (within 4 seconds)
      if (source === 'realtime') {
        const timeSinceLocal = Date.now() - localChangePendingRef.current;
        if (timeSinceLocal < 4000) return;
      }

      try {
        const [remoteExpenses, remoteSalaries] = await Promise.all([
          fetchUserExpenses(userId),
          fetchUserSalaries(userId),
        ]);

        if (cancelled) return;

        setStore(() => {
          // Read THIS user's cached local store (not guest)
          const userLocalRaw = localStorage.getItem(getStoreStorageKey(userId));
          const userLocal = userLocalRaw ? parseStore(userLocalRaw) : null;

          const remoteList = (remoteExpenses || []).map((e) => ({
            id: e.id,
            amount: Number(e.amount),
            description: e.description,
            category: e.category,
            date: e.date,
            notes: e.notes || '',
          }));

          let mergedExpenses: typeof remoteList = [];
          if (remoteList.length > 0) {
            const remoteMap = new Map(remoteList.map((e) => [e.id, e]));
            // Push any local-only expenses (from this user's key only) to Supabase
            (userLocal?.expenses || []).forEach((localExp) => {
              if (!remoteMap.has(localExp.id)) {
                saveExpenseToDb(userId, localExp);
                remoteMap.set(localExp.id, localExp);
              }
            });
            mergedExpenses = Array.from(remoteMap.values()).sort((a, b) => b.date.localeCompare(a.date));
          } else if (userLocal && userLocal.expenses.length > 0) {
            userLocal.expenses.forEach((e) => saveExpenseToDb(userId, e));
            mergedExpenses = userLocal.expenses;
          }

          const remoteSalaryMap = remoteSalaries || {};
          let mergedSalaries: Record<string, number> = {};
          if (Object.keys(remoteSalaryMap).length > 0) {
            mergedSalaries = { ...(userLocal?.salaries || {}), ...remoteSalaryMap };
            Object.entries(userLocal?.salaries || {}).forEach(([m, amt]) => {
              if (remoteSalaryMap[m] === undefined) saveSalaryToDb(userId, m, amt);
            });
          } else if (userLocal && Object.keys(userLocal.salaries).length > 0) {
            Object.entries(userLocal.salaries).forEach(([m, amt]) => saveSalaryToDb(userId, m, amt));
            mergedSalaries = userLocal.salaries;
          }

          const finalStore: FinanceStore = {
            expenses: mergedExpenses,
            salaries: mergedSalaries,
            categories: userLocal?.categories && userLocal.categories.length > 0 ? userLocal.categories : [...BASE_CATEGORIES],
            customCategories: userLocal?.customCategories || [],
          };

          localStorage.setItem(getStoreStorageKey(userId), JSON.stringify(finalStore));
          return finalStore;
        });
      } catch (err) {
        console.warn('Supabase sync error:', err);
      }
    };

    // 1. If user switched, reset to empty first; otherwise keep cached data visible during refresh
    if (userChanged) {
      const cachedRaw = localStorage.getItem(getStoreStorageKey(userId));
      setStore(cachedRaw ? parseStore(cachedRaw) : fallbackStore);
    }

    // 2. Initial fetch from Supabase
    loadSupabaseData('initial');

    // 3. Realtime channel — debounced + suppressed for own writes
    const handleRealtimeEvent = () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        loadSupabaseData('realtime');
      }, 1500);
    };

    const channel = supabase
      .channel(`realtime-sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${userId}` }, handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salaries', filter: `user_id=eq.${userId}` }, handleRealtimeEvent)
      .subscribe();

    // 4. Refetch on visibility change — only if hidden for >60 seconds
    let hiddenAt: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
        const hiddenForMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (hiddenForMs > 60000) {
          loadSupabaseData('realtime');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: uid() };
    setStore((current) => ({ ...current, expenses: [newExpense, ...current.expenses] }));
    notify('Expense tucked away.');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveExpenseToDb(user.id, newExpense);
    }
  };

  const updateExpense = (id: string, changes: Omit<Expense, 'id'>) => {
    const updated: Expense = { ...changes, id };
    setStore((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => (expense.id === id ? updated : expense)),
    }));
    notify('Expense updated.');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveExpenseToDb(user.id, updated);
    }
  };

  const deleteExpense = (id: string) => {
    setStore((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }));
    notify('Expense removed.', 'danger');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      deleteExpenseFromDb(user.id, id);
    }
  };

  const setSalary = (month: string, salary: number) => {
    setStore((current) => ({ ...current, salaries: { ...current.salaries, [month]: salary } }));
    notify(`${monthLabel(month)} salary saved.`);

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveSalaryToDb(user.id, month, salary);
    }
  };

  const syncWithSupabase = async () => {
    if (!user || !isRealSupabaseUser(user)) {
      notify('Please sign in with a Supabase account to sync.', 'danger');
      return;
    }
    setIsSyncing(true);
    notify('Syncing all data to Supabase...');
    try {
      for (const exp of store.expenses) {
        await saveExpenseToDb(user.id, exp);
      }
      for (const [m, amt] of Object.entries(store.salaries)) {
        await saveSalaryToDb(user.id, m, amt);
      }
      notify('Supabase database is fully up to date!');
    } catch {
      notify('Failed to complete sync.', 'danger');
    } finally {
      setIsSyncing(false);
    }
  };

  const addCategory = (category: string) => {
    const clean = category.trim();
    if (!clean) return false;
    if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      notify('Category already exists.', 'danger');
      return false;
    }
    setStore((current) => {
      const currentCats = current.categories && current.categories.length > 0 ? current.categories : [...BASE_CATEGORIES];
      return {
        ...current,
        categories: [...currentCats, clean],
        customCategories: [...(current.customCategories || []), clean],
      };
    });
    notify(`Added "${clean}" category.`);
    return true;
  };

  const removeCategory = (category: string) => {
    if (categories.length <= 1) {
      notify('Must keep at least one category.', 'danger');
      return;
    }
    setStore((current) => {
      const currentCats = current.categories && current.categories.length > 0 ? current.categories : [...BASE_CATEGORIES];
      const filtered = currentCats.filter((item) => item.toLowerCase() !== category.toLowerCase());
      const filteredCustom = (current.customCategories || []).filter((item) => item.toLowerCase() !== category.toLowerCase());
      return {
        ...current,
        categories: filtered,
        customCategories: filteredCustom,
      };
    });
    notify(`Removed "${category}" category.`);
  };

  const importStore = (imported: Partial<FinanceStore>) => {
    try {
      const expenses = Array.isArray(imported.expenses) ? imported.expenses : [];
      const salaries = imported.salaries && typeof imported.salaries === 'object' ? imported.salaries : {};
      const customCategories = Array.isArray(imported.customCategories) ? imported.customCategories : [];
      setStore({ expenses, salaries, customCategories });
      notify('Backup restored successfully!');
      if (user && isRealSupabaseUser(user)) {
        expenses.forEach((e) => saveExpenseToDb(user.id, e));
        Object.entries(salaries).forEach(([m, amt]) => saveSalaryToDb(user.id, m, amt));
      }
      return true;
    } catch {
      notify('Could not restore backup file.', 'danger');
      return false;
    }
  };

  const reset = () => {
    setStore(fallbackStore);
    notify('Your local data is clear.');
  };

  return {
    store,
    categories,
    toast,
    isSyncing,
    syncWithSupabase,
    addExpense,
    updateExpense,
    deleteExpense,
    setSalary,
    addCategory,
    removeCategory,
    importStore,
    reset,
  };
}

function AppShell({
  children,
  toast,
  theme,
  toggleTheme,
}: {
  children: ReactNode;
  toast: { message: string; kind: 'success' | 'danger' } | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'HOME', icon: Landmark },
    { href: '/summary', label: 'REPORTS', icon: TrendingUp },
    { href: '/expenses', label: 'LEDGER', icon: ScrollText },
    { href: '/settings', label: 'SETTINGS', icon: UserCog },
  ];

  return (
    <div className="app-grain min-h-[100dvh] bg-background text-foreground transition-colors duration-200">

      {/* ── Top Header Navigation Bar (Desktop only, hidden on mobile) ── */}
      <header className="sticky top-0 z-50 hidden w-full border-b border-border/40 bg-background/85 backdrop-blur-xl transition-colors sm:block">
        <div className="mx-auto flex h-16 max-w-[1420px] items-center justify-between px-3.5 sm:px-8 lg:px-12">
          {/* Brand Logo & Name */}
          <Brand />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur-md sm:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider transition-all duration-200 ${
                    active
                      ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/20'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Add Expense Button */}
            <Link
              href="/add-expense"
              data-testid="link-nav-add"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-md shadow-accent/25 transition-all hover:scale-105 active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Expense</span>
            </Link>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

            {/* User Account or Sign In */}
            {user ? (
              <Link
                href="/settings"
                data-testid="link-nav-profile"
                className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-primary/20 transition hover:bg-primary/25 hover:ring-primary/40"
                title={`Logged in as ${user.email}`}
              >
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </Link>
            ) : (
              <Link
                href="/login"
                data-testid="link-nav-login"
                className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
                title="Sign In"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation (hidden on sm+) ── */}
      <MobileBottomNav location={location} theme={theme} toggleTheme={toggleTheme} />

      {/* ── Main Content ── */}
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1420px] px-3.5 pb-24 pt-4 sm:px-8 sm:pb-16 sm:pt-6 lg:px-12">
        {children}
      </main>

      {/* Floating Toast */}
      {toast && (
        <div
          role="status"
          data-testid="status-toast"
          className={`fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-2xl sm:bottom-6 ${
            toast.kind === 'danger' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background'
          }`}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" data-testid="link-brand" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
      <div className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent/10 shadow-md ring-1 ring-border sm:h-10 sm:w-10 sm:rounded-2xl">
        <img
          src="/logo.png"
          alt="Spendly Logo"
          className="h-full w-full object-cover transition-transform group-hover:scale-110"
        />
      </div>
      <span className={`inline ${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-display font-bold tracking-tight text-foreground`}>
        spendly<span className="text-accent">.</span>
      </span>
    </Link>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-testid={`link-nav-${label.toLowerCase()}`}
      className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${active
          ? 'bg-sidebar-foreground/[.12] text-sidebar-foreground'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/[.07] hover:text-sidebar-foreground'
        }`}
    >
      <Icon className={`h-[18px] w-[18px] transition-transform group-hover:scale-105 ${active ? 'text-accent' : ''}`} />
      <span>{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
    </Link>
  );
}

function FloatingNavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={`link-nav-${label.toLowerCase()}`}
      className={`floating-nav-item ${active ? 'floating-nav-item--active' : ''}`}
      title={label}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function MobileBottomNav({
  location,
  theme,
  toggleTheme,
}: {
  location: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  return (
    <div className="spendly-bottom-bar-wrap sm:hidden">
      {/* Curved 4-Button Dock */}
      <nav className="spendly-bottom-bar" aria-label="Mobile Spendly Navigation">
        {/* Home */}
        <Link
          href="/"
          data-testid="link-mobile-home"
          className={`spendly-bottom-nav-btn ${location === '/' ? 'spendly-bottom-nav-btn--active' : ''}`}
          title="Home"
        >
          <Landmark className="h-4 w-4" />
          <span>HOME</span>
        </Link>

        {/* Reports */}
        <Link
          href="/summary"
          data-testid="link-mobile-summary"
          className={`spendly-bottom-nav-btn ${location === '/summary' ? 'spendly-bottom-nav-btn--active' : ''}`}
          title="Reports"
        >
          <TrendingUp className="h-4 w-4" />
          <span>REPORTS</span>
        </Link>

        {/* Ledger */}
        <Link
          href="/expenses"
          data-testid="link-mobile-expenses"
          className={`spendly-bottom-nav-btn ${location.startsWith('/expenses') ? 'spendly-bottom-nav-btn--active' : ''}`}
          title="Ledger"
        >
          <ScrollText className="h-4 w-4" />
          <span>LEDGER</span>
        </Link>

        {/* Profile */}
        <Link
          href="/settings"
          data-testid="link-mobile-settings"
          className={`spendly-bottom-nav-btn ${location === '/settings' ? 'spendly-bottom-nav-btn--active' : ''}`}
          title="Profile"
        >
          <UserCog className="h-4 w-4" />
          <span>PROFILE</span>
        </Link>
      </nav>

      {/* Separate Floating Glowing Gold + Add Button */}
      <Link
        href="/add-expense"
        data-testid="link-mobile-add"
        aria-label="Add transaction"
        className="spendly-bottom-add-btn"
        title="Add Transaction"
      >
        <Plus className="h-6 w-6 stroke-[3]" />
      </Link>
    </div>
  );
}


function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 max-w-2xl font-display text-[clamp(2.25rem,5vw,4.2rem)] leading-[.98] tracking-[-.045em]">{title}</h1>
        {description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode;
  variant?: 'primary' | 'quiet' | 'outline' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
    quiet: 'bg-muted text-foreground hover:bg-border',
    outline: 'border border-border bg-card text-foreground hover:border-primary hover:text-primary',
    danger: 'bg-destructive text-destructive-foreground hover:-translate-y-0.5 active:translate-y-0',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 ${className}`}
    />
  );
}

function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full appearance-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${className}`}
    />
  );
}

function MonthPicker({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <label className={`relative inline-flex items-center ${compact ? 'min-w-[160px]' : 'min-w-[200px]'}`}>
      <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-primary" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid="select-month"
        className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm font-bold text-foreground outline-none transition hover:border-primary focus:border-primary"
      >
        {getMonthOptions(value).map((month) => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
    </label>
  );
}

function getMonthOptions(selected: string) {
  const options = new Set<string>();
  const current = new Date();
  for (let i = -8; i <= 4; i++) options.add(monthKey(new Date(current.getFullYear(), current.getMonth() + i, 1)));
  options.add(selected);
  return Array.from(options).sort().reverse();
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'mint',
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  tone?: 'mint' | 'coral' | 'cream' | 'plum';
  testId: string;
}) {
  const tones = {
    mint: 'bg-[#e0e7ff] text-[#3730a3] dark:bg-[#1e1b4b] dark:text-[#c7d2fe] border-indigo-200/50 dark:border-indigo-900/50',
    coral: 'bg-[#f4d8cc] text-[#4a2218] dark:bg-[#3d241d] dark:text-[#f4b8a5] border-rose-200/50 dark:border-rose-950/50',
    cream: 'bg-[#f0e6c7] text-[#423315] dark:bg-[#38311d] dark:text-[#f0d99d] border-amber-200/50 dark:border-amber-950/50',
    plum: 'bg-[#e6ddea] text-[#3b2746] dark:bg-[#34243d] dark:text-[#d9c4e2] border-purple-200/50 dark:border-purple-950/50',
  };
  return (
    <article
      data-testid={testId}
      className={`rise-in relative flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 sm:p-5 ${tones[tone]} border transition-all duration-200 hover:shadow-md`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[.12em] sm:tracking-[.14em] opacity-80 leading-tight truncate">
          {label}
        </span>
        <span className="grid h-6 w-6 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg bg-black/5 dark:bg-white/10">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-85" />
        </span>
      </div>
      <div className="mt-2.5 sm:mt-5">
        <p className="font-display text-lg sm:text-3xl xl:text-[2.1rem] font-bold tracking-tight leading-none">
          {value}
        </p>
        <p className="mt-1 text-[10px] sm:text-xs opacity-75 truncate sm:whitespace-normal font-medium leading-tight">
          {detail}
        </p>
      </div>
    </article>
  );
}

function SpendlyMobileHome({
  finance,
  selectedMonth,
  setSelectedMonth,
  salary,
  spent,
  balance,
  expenses,
}: {
  finance: ReturnType<typeof useFinance>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  salary: number;
  spent: number;
  balance: number;
  expenses: Expense[];
}) {
  const { user, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState('All');

  const greeting = getGreeting();
  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Alex Kim');

  const userInitial = userName ? userName[0].toUpperCase() : 'A';

  const filteredExpenses = useMemo(() => {
    if (activeCategory === 'All') return expenses;
    return expenses.filter((e) => e.category.toLowerCase() === activeCategory.toLowerCase());
  }, [expenses, activeCategory]);

  // Curated category filter list on home page to keep it clean and uncluttered (All, Food, Travel, Shopping)
  const homeCategories = useMemo(() => {
    const activeCatsInMonth = Array.from(new Set(expenses.map((e) => e.category)));
    const defaults = ['Food', 'Travel', 'Shopping'];
    const merged = Array.from(new Set([...defaults, ...activeCatsInMonth]));
    return merged.slice(0, 3);
  }, [expenses]);

  return (
    <div className="space-y-3.5">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs font-medium text-[#9ca3af] tracking-wide flex items-center gap-1">
            {greeting}
          </p>
          <h1 className="text-2xl font-serif font-black text-[#ffffff] tracking-tight mt-0.5">
            {userName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Month Selector Dropdown Pill */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-full bg-[#101626] border border-[#fbbf24]/30 px-3 py-1.5 pr-7 text-[11px] font-bold text-[#fde68a] outline-none"
            >
              {getMonthOptions(selectedMonth).map((m) => (
                <option key={m} value={m} className="bg-[#0b0f19] text-[#f3f4f6]">
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#fbbf24]" />
          </div>

          {/* User Avatar with Glowing Gold Ring */}
          <Link
            href="/settings"
            className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#d97706] to-[#fbbf24] text-sm font-black text-[#080c14] shadow-[0_0_16px_rgba(245,158,11,0.45)] ring-2 ring-[#fbbf24] ring-offset-2 ring-offset-[#080c14] transition active:scale-95"
            title="Profile & Settings"
          >
            {userInitial}
          </Link>
        </div>
      </div>

      {/* ── SPENDLY LUXURY GOLD OBSIDIAN CREDIT CARD HERO ── */}
      <div className="spendly-credit-card">
        {/* Card Sheen & Mesh Texture Overlay */}
        <div className="spendly-credit-card__sheen" />
        <div className="spendly-credit-card__mesh-pattern" />

        {/* Top Row: Smart Chip, Contactless Wave & Tier Logo */}
        <div className="spendly-credit-card__top">
          <div className="flex items-center gap-2.5">
            {/* Gold EMV Smart Chip */}
            <div className="spendly-chip" title="EMV Smart Chip">
              <div className="spendly-chip__line spendly-chip__line--h" />
              <div className="spendly-chip__line spendly-chip__line--v" />
              <div className="spendly-chip__core" />
            </div>

            {/* Contactless Wave Icon */}
            <svg
              className="h-4.5 w-4.5 text-[#fbbf24]/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M8.5 16.5a5 5 0 0 1 0-9" />
              <path d="M12 19a8.5 8.5 0 0 0 0-14" />
              <path d="M15.5 21.5a12 12 0 0 0 0-19" />
            </svg>
          </div>

          {/* Brand & Platinum Tier Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#fde68a] drop-shadow-sm font-display">
              SPENDLY
            </span>
            <span className="rounded-full bg-[#1e1c12] border border-[#fbbf24]/40 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-[#fde68a] shadow-sm">
              PRIVATE WEALTH
            </span>
          </div>
        </div>

        {/* Card Body: Total Balance */}
        <div className="spendly-credit-card__body">
          <p className="spendly-credit-card__label">Total Balance</p>
          <p className="spendly-credit-card__amount" data-testid="spendly-total-balance">
            {rupees(balance)}
          </p>
        </div>

        {/* Card Footer: Embossed Number, Cardholder, Expiry & Hologram */}
        <div className="spendly-credit-card__footer">
          <div>
            <p className="spendly-credit-card__number font-mono">
              •••• &nbsp;•••• &nbsp;•••• &nbsp;{selectedMonth ? selectedMonth.replace('-', '') : '2026'}
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-wider text-[#9ca3af]">Cardholder</p>
                <p className="text-[11px] font-bold text-white uppercase tracking-wide truncate max-w-[130px]">
                  {userName}
                </p>
              </div>
              <div>
                <p className="text-[7.5px] font-bold uppercase tracking-wider text-[#9ca3af]">Valid Thru</p>
                <p className="text-[11px] font-bold text-white font-mono tracking-wider">
                  {selectedMonth ? selectedMonth.slice(5) : '09'}/29
                </p>
              </div>
            </div>
          </div>

          {/* Holographic Overlapping Spheres */}
          <div className="spendly-card-network" title="Spendly Network">
            <div className="spendly-card-network__circle spendly-card-network__circle--1" />
            <div className="spendly-card-network__circle spendly-card-network__circle--2" />
          </div>
        </div>

        {/* Dual Frosted Glass Badges: Income & Expenses */}
        <div className="spendly-card-pills">
          {/* Income Pill */}
          <div className="spendly-card-pill spendly-card-pill--income">
            <div className="spendly-card-pill__icon spendly-card-pill__icon--income">
              <ArrowDownLeft className="h-3.5 w-3.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="spendly-card-pill__label">Income</p>
              <p className="spendly-card-pill__value truncate">{rupees(salary)}</p>
            </div>
          </div>

          {/* Expenses Pill */}
          <div className="spendly-card-pill spendly-card-pill--expense">
            <div className="spendly-card-pill__icon spendly-card-pill__icon--expense">
              <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="spendly-card-pill__label">Expenses</p>
              <p className="spendly-card-pill__value truncate">{rupees(spent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section Header */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <h2 className="text-base font-bold text-[#f1f5f3] tracking-tight">Transactions</h2>
        <Link
          href="/expenses"
          data-testid="link-spendly-see-all"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#fbbf24] hover:text-[#fde68a] transition"
        >
          <span>See all</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Horizontal Category Carousel Filter Chips */}
      <div className="spendly-cat-carousel">
        <button
          type="button"
          onClick={() => setActiveCategory('All')}
          className={`spendly-cat-chip ${activeCategory === 'All' ? 'spendly-cat-chip--active' : 'spendly-cat-chip--inactive'}`}
        >
          <span>All</span>
        </button>
        {homeCategories.map((cat) => {
          const IconComponent = getCategoryIcon(cat);
          const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(isSelected ? 'All' : cat)}
              className={`spendly-cat-chip ${isSelected ? 'spendly-cat-chip--active' : 'spendly-cat-chip--inactive'}`}
            >
              <IconComponent className="h-3.5 w-3.5 shrink-0" />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Arched Lower Sheet for Transactions */}
      <div className="spendly-sheet">
        {/* Top Notch Handle */}
        <div className="spendly-sheet__notch" />

        {/* Transaction Rows in Dark Glass */}
        <div className="space-y-2.5">
          {salary > 0 && (activeCategory === 'All' || activeCategory.toLowerCase().includes('salary')) && (
            <div className="spendly-tx-card">
              <div className="flex items-center gap-3 min-w-0">
                <div className="spendly-tx-card__icon text-[#fbbf24]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="spendly-tx-card__title truncate">Salary deposit</p>
                  <p className="spendly-tx-card__sub truncate">Income • {monthLabel(selectedMonth)}</p>
                </div>
              </div>
              <p className="spendly-tx-card__amount spendly-tx-card__amount--income">
                +{rupees(salary)}
              </p>
            </div>
          )}

          {filteredExpenses.length > 0 ? (
            filteredExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  onClick={() => setLocation(`/add-expense/${expense.id}`)}
                  className="spendly-tx-card cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="spendly-tx-card__icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="spendly-tx-card__title truncate">{expense.description}</p>
                      <p className="spendly-tx-card__sub truncate">
                        {expense.category} • {shortDate(expense.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="spendly-tx-card__amount spendly-tx-card__amount--expense">
                      -{rupees(expense.amount)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-[#fbbf24]/15 bg-[#101626]/80 p-5 text-center backdrop-blur-md">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20 shadow-inner">
                <ReceiptIndianRupee className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-xs font-bold text-[#e2e8f0]">No transactions in this category</p>
              <p className="mt-0.5 text-[11px] text-[#9ca3af]">Tap the '+' button to record an expense.</p>
              <button
                type="button"
                onClick={() => setLocation('/add-expense')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-3.5 py-1.5 text-xs font-bold text-[#080c14] shadow-[0_0_14px_rgba(245,158,11,0.35)] transition active:scale-95"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Add expense</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const currentMonth = monthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const salary = finance.store.salaries[selectedMonth] ?? 0;
  const expenses = useMemo(
    () => finance.store.expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth),
    [finance.store.expenses, selectedMonth],
  );
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = salary - spent;
  const hasAnyData = Object.keys(finance.store.salaries).length > 0 || finance.store.expenses.length > 0;
  const percent = salary ? Math.round((spent / salary) * 100) : 0;
  const recent = expenses
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const categoryBreakdown = finance.categories
    .map((category, index) => ({
      category,
      amount: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const largestCategorySpend = Math.max(...categoryBreakdown.map((item) => item.amount), 1);

  return (
    <div className="page-enter">
      {/* ── SPENDLY MOBILE HOME UI (strictly for phone users < 640px) ── */}
      <div className="sm:hidden">
        <SpendlyMobileHome
          finance={finance}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          salary={salary}
          spent={spent}
          balance={balance}
          expenses={expenses}
        />
      </div>

      {/* ── DESKTOP HOME UI (strictly for desktop/tablet >= 640px) ── */}
      <div className="hidden sm:block">
        <PageIntro
          eyebrow={hasAnyData ? 'Your month at a glance' : 'A softer way to stay aware'}
          title={
            <>
              {hasAnyData ? (
                <>
                  Make room for
                  <br />
                  <span className="text-primary">what matters.</span>
                </>
              ) : (
                <>
                  Let’s make your
                  <br />
                  <span className="text-primary">money visible.</span>
                </>
              )}
            </>
          }
          description={
            hasAnyData
              ? `Here’s the shape of ${monthLabel(selectedMonth).toLowerCase()} so far.`
              : 'Start with your monthly take-home. Then add the little things — the picture gets clearer quickly.'
          }
          action={
            <div className="flex items-center gap-2">
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
              <Link href="/add-expense" data-testid="link-add-expense-header" className="hidden sm:inline-flex">
                <Button>
                  <Plus className="h-4 w-4" /> Add expense
                </Button>
              </Link>
            </div>
          }
        />

        {!hasAnyData && <SetupCard month={selectedMonth} salary={salary} onSave={finance.setSalary} />}

        {hasAnyData && (
          <div className="rounded-3xl border border-card-border/80 bg-card/60 p-2.5 sm:p-0 sm:border-0 sm:bg-transparent shadow-[var(--shadow-card)] sm:shadow-none backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
              <MetricCard
                testId="metric-salary"
                label="Monthly salary"
                value={rupees(salary)}
                detail={salary ? 'Your take-home for this month' : 'Add a salary to see balance'}
                icon={Banknote}
                tone="mint"
              />
              <MetricCard
                testId="metric-spent"
                label="Spent so far"
                value={rupees(spent)}
                detail={`${expenses.length} ${expenses.length === 1 ? 'transaction' : 'transactions'}`}
                icon={TrendingDown}
                tone="coral"
              />
              <MetricCard
                testId="metric-balance"
                label={balance < 0 ? 'Over by' : 'Left to spend'}
                value={rupees(Math.abs(balance))}
                detail={balance < 0 ? 'A gentle pause' : `${Math.max(0, 100 - percent)}% remains`}
                icon={balance < 0 ? CircleAlert : CircleDollarSign}
                tone={balance < 0 ? 'coral' : 'cream'}
              />
              <MetricCard
                testId="metric-progress"
                label="Spent %"
                value={`${percent}%`}
                detail={salary ? (percent > 100 ? 'Needs a reset' : 'Pace on track') : 'Set salary first'}
                icon={BarChart3}
                tone="plum"
              />
            </div>
          </div>
        )}

        {hasAnyData && (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
            <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary">Your pace</p>
                  <h2 className="mt-1 font-display text-2xl">Spending this month</h2>
                </div>
                <Link href="/summary" data-testid="link-view-summary" className="text-xs font-bold text-primary hover:underline">
                  See full summary <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row">
                <ProgressRing percent={percent} />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {percent > 100
                      ? 'You’ve spent beyond your planned take-home. No judgement — the next useful move is to see exactly where.'
                      : percent > 75
                        ? 'You’re in the final stretch of your monthly budget. A little awareness now can make the last week easier.'
                        : 'There is plenty of month left. Keep recording the small choices and let the pattern do the talking.'}
                  </p>
                  <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {rupees(spent)} spent
                    <span className="ml-3 h-2 w-2 rounded-full bg-muted-foreground/30" />
                    {rupees(Math.max(0, salary - spent))} remaining
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary">Latest notes</p>
                  <h2 className="mt-1 font-display text-2xl">Recent expenses</h2>
                </div>
                <Link href="/expenses" data-testid="link-view-expenses" className="text-xs font-bold text-primary hover:underline">
                  View all <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
              {recent.length ? (
                <div className="mt-5 space-y-1">
                  {recent.map((expense, index) => (
                    <ExpenseRow key={expense.id} expense={expense} index={index} compact />
                  ))}
                </div>
              ) : (
                <EmptyExpenses compact />
              )}
            </section>

            <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:col-span-2 sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary">The shape of it</p>
                  <h2 className="mt-1 font-display text-2xl">Where the month is going</h2>
                </div>
                <Link href="/summary" data-testid="link-dashboard-category-breakdown" className="text-xs font-bold text-primary hover:underline">
                  Open summary <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
              {categoryBreakdown.length ? (
                <div className="mt-7 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  {categoryBreakdown.map((item, index) => (
                    <div key={item.category} className="rise-in" style={{ animationDelay: `${index * 60}ms` }}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.category}
                        </span>
                        <span className="font-mono-ui text-xs">{rupees(item.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(item.amount / largestCategorySpend) * 100}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyExpenses compact />
              )}
            </section>
          </div>
        )}

        {hasAnyData && !salary && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <p>
              <strong>No salary for {monthLabel(selectedMonth)} yet.</strong> Add it in{' '}
              <Link href="/settings" className="font-bold underline" data-testid="link-set-salary-alert">
                Settings
              </Link>{' '}
              to turn your spending into a useful picture.
            </p>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">A good money habit can start with one line.</p>
          <Link href="/add-expense" data-testid="link-add-expense-footer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            <Plus className="h-4 w-4" /> Record something
          </Link>
        </div>
      </div>
    </div>
  );
}

function SetupCard({ month, salary, onSave }: { month: string; salary: number; onSave: (month: string, salary: number) => void }) {
  const [value, setValue] = useState('');
  return (
    <section className="relative overflow-hidden rounded-3xl bg-sidebar p-6 text-sidebar-foreground shadow-[var(--shadow-soft)] sm:p-9">
      <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[22px] border-accent/30" />
      <div className="absolute -bottom-14 right-24 h-28 w-28 rounded-full bg-primary/20" />
      <div className="relative max-w-2xl">
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-accent text-foreground">
          <Banknote className="h-5 w-5" />
        </div>
        <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-accent">First, a little context</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">What comes in each month?</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-sidebar-foreground/65">
          Your salary is only used on this device to work out what’s left. It never leaves your browser.
        </p>
        <div className="mt-7 flex max-w-md flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-ui text-sm text-sidebar-foreground/50">₹</span>
            <Input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Monthly take-home"
              data-testid="input-first-salary"
              className="border-sidebar-foreground/20 bg-sidebar-foreground/10 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:border-accent"
            />
          </label>
          <Button testId="button-save-first-salary" disabled={!Number(value)} onClick={() => onSave(month, Number(value))}>
            <Check className="h-4 w-4" /> Save salary
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const safe = Math.min(percent, 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={percent > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (safe / 100) * circumference}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span className="font-display text-3xl">{percent}%</span>
        <span className="absolute bottom-8 text-[10px] uppercase tracking-widest text-muted-foreground">used</span>
      </div>
    </div>
  );
}


function ExpenseRow({
  expense,
  index,
  compact = false,
  onEdit,
  onDelete,

}: {
  expense: Expense;
  index: number;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const color = CATEGORY_COLORS[Math.max(0, BASE_CATEGORIES.indexOf(expense.category)) % CATEGORY_COLORS.length];
  return (
    <div
      data-testid={`row-expense-${expense.id}`}
      className={`rise-in stagger-${Math.min(index + 1, 5)} group flex items-center gap-3 rounded-xl px-3 py-3.5 transition hover:bg-muted/60 ${compact ? '' : 'border-b border-border/50 last:border-0'}`}
    >
      {/* Category icon */}
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {expense.category.slice(0, 1)}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-snug">{expense.description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {expense.category} <span className="px-1 opacity-40">·</span> {shortDate(expense.date)}
        </p>
        {!compact && expense.notes && (
          <p className="mt-0.5 truncate text-xs italic text-muted-foreground/70">{expense.notes}</p>
        )}
      </div>

      {/* Amount */}
      <p className="font-mono-ui text-sm font-semibold tabular-nums">{rupees(expense.amount)}</p>

      {/* Action buttons — always visible on mobile, hover-reveal on desktop */}
      {(onEdit || onDelete) && (
        <div className="ml-1 flex items-center gap-0.5 sm:hidden sm:group-hover:flex">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${expense.description}`}
              data-testid={`button-edit-${expense.id}`}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-95"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${expense.description}`}
              data-testid={`button-delete-${expense.id}`}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Desktop: hover reveal only */}
      {(onEdit || onDelete) && (
        <div className="ml-1 hidden items-center gap-0.5 group-hover:flex max-sm:hidden">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${expense.description}`}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${expense.description}`}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyExpenses({ compact = false }: { compact?: boolean }) {

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'rounded-2xl border border-dashed border-border py-16'}`}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-primary">
        <ReceiptIndianRupee className="h-5 w-5" />
      </div>
      <p className="mt-4 font-display text-xl">No expenses here yet.</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">The quiet is useful. Add your first expense when you’re ready.</p>
      {!compact && (
        <Link href="/add-expense" data-testid="link-empty-add" className="mt-5">
          <Button>
            <Plus className="h-4 w-4" /> Add first expense
          </Button>
        </Link>
      )}
    </div>
  );
}

function SpendlyMobileExpenses({
  finance,
  selectedMonth,
  setSelectedMonth,
  query,
  setQuery,
  category,
  setCategory,
  dateFilter,
  setDateFilter,
  expenses,
  monthExpenses,
  setLocation,
  setDeleteId,
}: {
  finance: ReturnType<typeof useFinance>;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  query: string;
  setQuery: (q: string) => void;
  category: string;
  setCategory: (c: string) => void;
  dateFilter: string;
  setDateFilter: (d: string) => void;
  expenses: Expense[];
  monthExpenses: Expense[];
  setLocation: (url: string) => void;
  setDeleteId: (id: string | null) => void;
}) {
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs font-semibold text-[#9ca3af]">Monthly Records</p>
          <h1 className="text-xl font-serif font-extrabold text-[#f1f5f3] tracking-tight">
            All Transactions
          </h1>
        </div>
        {/* Month Selector Pill */}
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none rounded-full bg-[#101626] border border-[#fbbf24]/30 px-3 py-1.5 pr-7 text-[11px] font-bold text-[#fde68a] outline-none"
          >
            {getMonthOptions(selectedMonth).map((m) => (
              <option key={m} value={m} className="bg-[#0b0f19] text-[#f3f4f6]">
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#fbbf24]" />
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or category..."
          className="w-full rounded-2xl bg-[#101626] border border-[#fbbf24]/20 pl-10 pr-4 py-2.5 text-xs text-[#f1f5f3] placeholder:text-[#9ca3af]/60 outline-none focus:border-[#fbbf24]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ca3af] hover:text-[#f1f5f3]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Category Carousel Filter Chips */}
      <div className="spendly-cat-carousel">
        <button
          type="button"
          onClick={() => setCategory('All')}
          className={`spendly-cat-chip ${category === 'All' ? 'spendly-cat-chip--active' : 'spendly-cat-chip--inactive'}`}
        >
          <span>All</span>
        </button>
        {finance.categories.map((cat) => {
          const IconComponent = getCategoryIcon(cat);
          const isSelected = category.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(isSelected ? 'All' : cat)}
              className={`spendly-cat-chip ${isSelected ? 'spendly-cat-chip--active' : 'spendly-cat-chip--inactive'}`}
            >
              <IconComponent className="h-3.5 w-3.5 shrink-0" />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Summary count and total */}
      <div className="flex items-center justify-between px-1 text-xs text-[#9ca3af]">
        <span>
          <strong className="text-[#f1f5f3]">{expenses.length}</strong> {expenses.length === 1 ? 'record' : 'records'}
        </span>
        <span className="font-bold text-[#fde68a]">{rupees(totalSpent)}</span>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {monthExpenses.length === 0 ? (
          <div className="rounded-2xl border border-[#fbbf24]/20 bg-[#101626]/60 p-8 text-center backdrop-blur-md">
            <ReceiptIndianRupee className="mx-auto h-8 w-8 text-[#fbbf24]/50" />
            <p className="mt-3 text-sm font-bold text-[#e2e8f0]">No records for {monthLabel(selectedMonth)}</p>
            <p className="mt-1 text-xs text-[#9ca3af]">Tap '+' to log your first expense.</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="rounded-2xl border border-[#fbbf24]/20 bg-[#101626]/60 p-8 text-center backdrop-blur-md">
            <SlidersHorizontal className="mx-auto h-6 w-6 text-[#9ca3af]" />
            <p className="mt-2 text-sm font-bold text-[#e2e8f0]">No matches found</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('All');
                setDateFilter('');
              }}
              className="mt-2 text-xs font-bold text-[#fbbf24] hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          expenses.map((expense) => {
            const Icon = getCategoryIcon(expense.category);
            return (
              <div key={expense.id} className="spendly-tx-card">
                <div
                  onClick={() => setLocation(`/add-expense/${expense.id}`)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <div className="spendly-tx-card__icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="spendly-tx-card__title truncate">{expense.description}</p>
                    <p className="spendly-tx-card__sub truncate">
                      {expense.category} • {shortDate(expense.date)}
                    </p>
                    {expense.notes && (
                      <p className="text-[10px] text-[#9ca3af]/80 truncate mt-0.5 italic">{expense.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="spendly-tx-card__amount spendly-tx-card__amount--expense">
                    -{rupees(expense.amount)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteId(expense.id)}
                    aria-label={`Delete ${expense.description}`}
                    className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#f87171] hover:bg-[#f87171]/10 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ExpensesPage({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const monthExpenses = finance.store.expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth);
  const expenses = monthExpenses
    .filter(
      (expense) =>
        (category === 'All' || expense.category === category) &&
        (!dateFilter || expense.date === dateFilter) &&
        `${expense.description} ${expense.category} ${expense.notes}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const deleting = finance.store.expenses.find((expense) => expense.id === deleteId);

  return (
    <div className="page-enter">
      {/* ── SPENDLY MOBILE EXPENSES UI (strictly for phone users < 640px) ── */}
      <div className="sm:hidden">
        <SpendlyMobileExpenses
          finance={finance}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          query={query}
          setQuery={setQuery}
          category={category}
          setCategory={setCategory}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          expenses={expenses}
          monthExpenses={monthExpenses}
          setLocation={setLocation}
          setDeleteId={setDeleteId}
        />
      </div>

      {/* ── DESKTOP EXPENSES UI (strictly for desktop/tablet >= 640px) ── */}
      <div className="hidden sm:block">
        <PageIntro
          eyebrow="The details matter"
          title="Your expenses."
          description="A searchable record of the small decisions that make up a month."
          action={
            <Link href="/add-expense" data-testid="link-add-expense">
              <Button>
                <Plus className="h-4 w-4" /> Add expense
              </Button>
            </Link>
          }
        />

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by description, notes or category"
                data-testid="input-search-expenses"
                className="border-transparent bg-muted/70 pl-10"
              />
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1 sm:w-[205px]">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="select-filter-category"
                  className="border-transparent bg-muted/70 pl-10"
                >
                  <option value="All">All categories</option>
                  {finance.categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </div>
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} compact />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" /> Exact date{' '}
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-testid="input-filter-date"
                className="w-auto border-transparent bg-muted/70 py-2 text-xs font-normal normal-case tracking-normal"
              />
            </label>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                data-testid="button-clear-date-filter"
                className="self-start text-xs font-bold text-primary hover:underline sm:self-auto"
              >
                Clear date
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{expenses.length}</span> {expenses.length === 1 ? 'expense' : 'expenses'} in{' '}
            {monthLabel(selectedMonth)}
          </p>
          <p className="font-mono-ui text-sm font-medium">{rupees(expenses.reduce((sum, item) => sum + item.amount, 0))}</p>
        </div>

        {monthExpenses.length === 0 ? (
          <EmptyExpenses />
        ) : expenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center">
            <SlidersHorizontal className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-display text-xl">Nothing matches that.</p>
            <button
              type="button"
              data-testid="button-clear-filters"
              onClick={() => {
                setQuery('');
                setCategory('All');
                setDateFilter('');
              }}
              className="mt-2 text-sm font-bold text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <section className="rounded-2xl border border-card-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-5">
            {expenses.map((expense, index) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                index={index}
                onEdit={() => setLocation(`/add-expense/${expense.id}`)}
                onDelete={() => setDeleteId(expense.id)}
              />
            ))}
          </section>
        )}
      </div>

      {deleteId && deleting && (
        <ConfirmDialog
          title="Remove this expense?"
          description={`“${deleting.description}” will be removed from your local records. This can’t be undone.`}
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            finance.deleteExpense(deleteId);
            setDeleteId(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ title, description, onClose, onConfirm }: { title: string; description: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <h2 className="mt-5 font-display text-2xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-7 flex justify-end gap-3">
          <Button variant="quiet" testId="button-cancel-delete" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" testId="button-confirm-delete" onClick={onConfirm}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function SpendlyMobileAddTransaction({
  finance,
  editing,
  existing,
  amount,
  setAmount,
  description,
  setDescription,
  category,
  setCategory,
  date,
  setDate,
  notes,
  setNotes,
  onSubmit,
  valid,
}: {
  finance: ReturnType<typeof useFinance>;
  editing: boolean;
  existing?: Expense;
  amount: string;
  setAmount: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  valid: boolean;
}) {
  const [, setLocation] = useLocation();
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [salaryMonth, setSalaryMonth] = useState(monthKey());
  const [customCatOpen, setCustomCatOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const handleSaveIncome = (e: FormEvent) => {
    e.preventDefault();
    if (!Number(amount)) return;
    finance.setSalary(salaryMonth, Number(amount));
    setLocation('/');
  };

  const addCustomCat = () => {
    if (finance.addCategory(customCategory)) {
      setCategory(customCategory.trim());
      setCustomCategory('');
      setCustomCatOpen(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setLocation('/expenses')}
          className="grid h-10 w-10 place-items-center rounded-full bg-[#101626] border border-[#fbbf24]/25 text-[#fde68a] transition active:scale-95 shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-serif font-bold text-[#f1f5f3] tracking-tight">
          {editing ? 'Edit Transaction' : 'Add Transaction'}
        </h1>
        <div className="w-10" />
      </div>

      {/* Hero Display Amount Box */}
      <div className="spendly-glass-card text-center relative overflow-hidden">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-24 bg-[#fbbf24]/15 blur-2xl rounded-full pointer-events-none" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
          {transactionType === 'income' ? 'TOTAL INCOME' : 'TOTAL EXPENSE'}
        </p>
        <div className="mt-2 flex items-center justify-center gap-1">
          <span className={`text-3xl font-extrabold ${transactionType === 'income' ? 'text-[#fbbf24]' : 'text-[#f87171]'}`}>₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
            className="w-48 bg-transparent text-center font-serif text-4xl font-black text-[#f1f5f3] outline-none placeholder:text-[#9ca3af]/40"
          />
        </div>
      </div>

      {/* Segmented Income / Expense Toggle */}
      <div className="spendly-segmented-toggle">
        <button
          type="button"
          onClick={() => setTransactionType('income')}
          className={`spendly-segment-btn ${transactionType === 'income' ? 'spendly-segment-btn--active' : ''}`}
        >
          <Wallet className="h-4 w-4" />
          <span>Income</span>
        </button>
        <button
          type="button"
          onClick={() => setTransactionType('expense')}
          className={`spendly-segment-btn ${transactionType === 'expense' ? 'spendly-segment-btn--active' : ''}`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Expense</span>
        </button>
      </div>

      {transactionType === 'income' ? (
        <form onSubmit={handleSaveIncome} className="space-y-4">
          <div className="spendly-glass-card space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider block mb-1.5">For Month</span>
              <div className="relative">
                <select
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-4 py-3 text-sm font-semibold text-[#f1f5f3] outline-none"
                >
                  {getMonthOptions(salaryMonth).map((m) => (
                    <option key={m} value={m} className="bg-[#0b0f19] text-[#f1f5f3]">
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#fbbf24]" />
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={!Number(amount)}
            className="spendly-neon-btn disabled:opacity-50"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>Save Income</span>
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="spendly-glass-card space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Netflix subscription"
                className="w-full rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-4 py-3 text-sm font-medium text-[#f1f5f3] placeholder:text-[#9ca3af]/50 outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Date
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-3.5 py-2.5 text-xs font-medium text-[#f1f5f3] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDate(todayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    date === todayStr ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#080c14]' : 'bg-[#101626] text-[#9ca3af] border border-[#fbbf24]/20'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDate(yesterdayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    date === yesterdayStr ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#080c14]' : 'bg-[#101626] text-[#9ca3af] border border-[#fbbf24]/20'
                  }`}
                >
                  Yesterday
                </button>
              </div>
            </div>

            {/* Category Dropdown Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setCustomCatOpen(!customCatOpen)}
                  className="text-xs font-bold text-[#fbbf24] hover:underline"
                >
                  {customCatOpen ? 'Cancel' : '+ Custom'}
                </button>
              </div>

              {customCatOpen ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name..."
                    autoFocus
                    className="flex-1 rounded-xl bg-[#101626] border border-[#fbbf24]/30 px-3.5 py-2.5 text-xs text-[#f1f5f3] outline-none focus:border-[#fbbf24]"
                  />
                  <button
                    type="button"
                    onClick={addCustomCat}
                    disabled={!customCategory.trim()}
                    className="rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-3.5 py-2.5 text-xs font-bold text-[#080c14] disabled:opacity-50 transition active:scale-95"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center">
                  {(() => {
                    const SelectedIcon = getCategoryIcon(category);
                    return (
                      <div className="pointer-events-none absolute left-3.5 flex items-center text-[#fbbf24]">
                        <SelectedIcon className="h-4 w-4" />
                      </div>
                    );
                  })()}
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__add_custom__') {
                        setCustomCatOpen(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full appearance-none rounded-xl bg-[#101626] border border-[#fbbf24]/25 py-3 pl-10 pr-10 text-sm font-semibold text-[#f1f5f3] outline-none transition focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 cursor-pointer"
                  >
                    {finance.categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0b0f19] text-[#f1f5f3]">
                        {cat}
                      </option>
                    ))}
                    <option value="__add_custom__" className="bg-[#0b0f19] text-[#fbbf24] font-bold">
                      + Add custom category...
                    </option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#fbbf24]" />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Note (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full resize-none rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-4 py-3 text-sm font-medium text-[#f1f5f3] placeholder:text-[#9ca3af]/50 outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
              />
            </div>
          </div>

          {/* Glowing Neon CTA Button */}
          <button
            type="submit"
            disabled={!valid}
            className="spendly-neon-btn disabled:opacity-50"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>{editing ? 'Save Changes' : 'Save Transaction'}</span>
          </button>
        </form>
      )}
    </div>
  );
}

function ExpenseFormPage({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const editing = Boolean(params.id);
  const existing = finance.store.expenses.find((expense) => expense.id === params.id);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'Food');
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [customOpen, setCustomOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const valid = Boolean(Number(amount) > 0 && description.trim().length > 0 && date);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const payload = { amount: Number(amount), description: description.trim(), category, date, notes: notes.trim() };
    if (editing && existing) finance.updateExpense(existing.id, payload);
    else finance.addExpense(payload);
    setLocation('/expenses');
  };

  const addCustom = () => {
    if (finance.addCategory(customCategory)) {
      setCategory(customCategory.trim());
      setCustomCategory('');
      setCustomOpen(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-3xl">
      {/* ── SPENDLY MOBILE ADD TRANSACTION UI (strictly for phone users < 640px) ── */}
      <div className="sm:hidden">
        <SpendlyMobileAddTransaction
          finance={finance}
          editing={editing}
          existing={existing}
          amount={amount}
          setAmount={setAmount}
          description={description}
          setDescription={setDescription}
          category={category}
          setCategory={setCategory}
          date={date}
          setDate={setDate}
          notes={notes}
          setNotes={setNotes}
          onSubmit={submit}
          valid={valid}
        />
      </div>

      {/* ── DESKTOP FORM UI (strictly for desktop/tablet >= 640px) ── */}
      <div className="hidden sm:block">
        <button
          type="button"
          onClick={() => setLocation('/expenses')}
          data-testid="button-back-expenses"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to expenses
        </button>

        <div className="mb-8">
          <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-primary">{editing ? 'Refine the record' : 'One small step'}</p>
          <h1 className="mt-2 font-display text-5xl leading-none tracking-[-.045em]">{editing ? 'Edit expense.' : 'Add an expense.'}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Keep it simple. You can always add more context later.</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Amount">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl text-primary">₹</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    data-testid="input-expense-amount"
                    className="h-16 border-primary/30 bg-primary/[.04] pl-11 font-display text-3xl placeholder:text-muted-foreground/40"
                    autoFocus
                  />
                </div>
              </Field>
            </div>

            <Field label="What was it?">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Evening chai with friends"
                data-testid="input-expense-description"
              />
            </Field>

            <Field label="When?">
              <div className="space-y-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-expense-date" />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDate(todayStr)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${date === todayStr ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(yesterdayStr)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${date === yesterdayStr ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            </Field>

            <Field label="Category">
              <div className="relative">
                <Select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-expense-category" className="pr-10">
                  {finance.categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <button
                type="button"
                onClick={() => setCustomOpen(!customOpen)}
                data-testid="button-toggle-custom-category"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Create custom category
              </button>
              {customOpen && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Category name"
                    data-testid="input-custom-category"
                  />
                  <Button type="button" onClick={addCustom} disabled={!customCategory.trim()} testId="button-save-custom-category">
                    Add
                  </Button>
                </div>
              )}
            </Field>

            <div className="sm:col-span-2">
              <Field label="Notes" hint="Optional — a little context makes the pattern more useful.">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What do you want to remember about this?"
                  rows={4}
                  data-testid="input-expense-notes"
                  className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-border pt-6 sm:flex-row">
            <Button variant="quiet" type="button" onClick={() => setLocation('/expenses')} testId="button-cancel-expense">
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} testId="button-save-expense">
              <Check className="h-4 w-4" />
              {editing ? 'Save changes' : 'Save expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SpendlyMobileSummary({
  finance,
  selectedMonth,
  setSelectedMonth,
  salary,
  spent,
  balance,
  expenses,
  userName,
  userEmail,
  isExporting,
  handleDownloadPdf,
}: {
  finance: ReturnType<typeof useFinance>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  salary: number;
  spent: number;
  balance: number;
  expenses: Expense[];
  userName: string;
  userEmail: string;
  isExporting: boolean;
  handleDownloadPdf: () => void;
}) {
  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const monthShortName = new Date(yearNum, monthNum - 1, 1).toLocaleString('default', { month: 'short' });

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const daysElapsed = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
  const remainingDays = Math.max(1, daysInMonth - (isCurrentMonth ? today.getDate() : 0));
  const dailyRunway = balance > 0 ? Math.round(balance / remainingDays) : 0;

  const spentPct = salary > 0 ? Math.round((spent / salary) * 100) : 0;
  const activeDaysCount = useMemo(() => {
    return new Set(expenses.map((e) => e.date)).size || (expenses.length ? 1 : 0);
  }, [expenses]);

  return (
    <div className="space-y-3.5">
      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between pt-1">
        {/* Month Selector Pill */}
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none rounded-full bg-[#101626] border border-[#fbbf24]/30 px-3 py-1.5 pl-8 pr-7 text-[11px] font-extrabold tracking-wider text-[#fde68a] outline-none shadow-sm"
          >
            {getMonthOptions(selectedMonth).map((m) => (
              <option key={m} value={m} className="bg-[#0b0f19] text-[#f3f4f6]">
                {monthLabel(m).toUpperCase()}
              </option>
            ))}
          </select>
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#fbbf24]" />
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#fbbf24]/80" />
        </div>

        {/* Center Editorial Title */}
        <div className="text-center">
          <h1 className="text-lg sm:text-xl font-serif font-extrabold text-white tracking-tight leading-tight">
            Financial Reports<span className="text-[#fbbf24]">.</span>
          </h1>
        </div>


      </div>
      {/* ── Monthly Budget Velocity Card ── */}
      <div className="spendly-glass-card !p-4 space-y-3.5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-white tracking-tight">
                Monthly Budget Velocity
              </h2>
              <p className="text-[11px] text-[#9ca3af] mt-0.5">
                {daysElapsed} of {daysInMonth} days elapsed
              </p>
            </div>
          </div>

          <span className="rounded-full bg-[#1e1c12] border border-[#fbbf24]/40 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-[#fde68a] uppercase">
            {spentPct}% UTILIZED
          </span>
        </div>

        {/* Glowing Gold Progress Slider Bar */}
        <div className="relative pt-1 pb-1">
          <div className="relative h-2 w-full rounded-full bg-[#080c14] border border-white/5 overflow-visible">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fde68a] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, spentPct))}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_10px_#fbbf24] border-2 border-[#fbbf24] transition-all duration-500 pointer-events-none"
              style={{ left: `calc(${Math.min(100, Math.max(0, spentPct))}% - 7px)` }}
            />
          </div>
        </div>

        {/* Bottom Row: SPENT vs REMAINING RUNWAY */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#9ca3af]">SPENT</p>
            <p className="font-serif text-xl font-bold text-white mt-0.5">{rupees(spent)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#9ca3af]">REMAINING RUNWAY</p>
            <p className="font-serif text-xl font-bold text-[#fde68a] mt-0.5">
              {rupees(balance >= 0 ? balance : 0)}{' '}
              <span className="font-sans text-xs font-semibold text-[#9ca3af]">
                ({rupees(dailyRunway)}/day)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── 4 Metric KPI Cards (2x2 Grid) ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* TAKE-HOME */}
        <div className="spendly-metric-card">
          <div className="spendly-metric-card__header">
            <span className="spendly-metric-card__label">TAKE-HOME</span>
            <div className="spendly-metric-card__icon">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="spendly-metric-card__value text-white" data-testid="mobile-summary-salary">
              {salary ? rupees(salary) : '₹0'}
            </p>
            <p className="spendly-metric-card__detail">
              {salary ? `↑ Credited ${monthShortName} 1` : 'Set in Profile'}
            </p>
          </div>
        </div>

        {/* TOTAL SPEND */}
        <div className="spendly-metric-card">
          <div className="spendly-metric-card__header">
            <span className="spendly-metric-card__label">TOTAL SPEND</span>
            <div className="spendly-metric-card__icon">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="spendly-metric-card__value text-white" data-testid="mobile-summary-expenses">
              {rupees(spent)}
            </p>
            <p className="spendly-metric-card__detail">
              🗂 {expenses.length} {expenses.length === 1 ? 'ledger item' : 'ledger items'}
            </p>
          </div>
        </div>

        {/* NET BALANCE */}
        <div className="spendly-metric-card">
          <div className="spendly-metric-card__header">
            <span className="spendly-metric-card__label">NET BALANCE</span>
            <div className="spendly-metric-card__icon">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p
              className={`spendly-metric-card__value ${balance < 0 ? 'text-[#f87171]' : 'text-[#fde68a]'}`}
              data-testid="mobile-summary-balance"
            >
              {rupees(Math.abs(balance))}
            </p>
            <p className="spendly-metric-card__detail">
              {balance >= 0 ? '✓ Surplus intact' : '⚠ Deficit alert'}
            </p>
          </div>
        </div>

        {/* AVG / ACTIVE TX */}
        <div className="spendly-metric-card">
          <div className="spendly-metric-card__header">
            <span className="spendly-metric-card__label">AVG / ACTIVE TX</span>
            <div className="spendly-metric-card__icon">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="spendly-metric-card__value text-white" data-testid="mobile-summary-average">
              {expenses.length ? rupees(spent / expenses.length) : '₹0'}
            </p>
            <p className="spendly-metric-card__detail">
              ⚡ {activeDaysCount} active days
            </p>
          </div>
        </div>
      </div>

      {/* ── Interactive Charts & Topology Container ── */}
      <ReportCharts
        expenses={expenses}
        salary={salary}
        selectedMonth={selectedMonth}
        categories={finance.categories}
        categoryColors={CATEGORY_COLORS}
      />

      {/* ── Optimal Burn Discipline / Audit PDF Card ── */}
      <div className="spendly-glass-card !p-3.5 flex items-center justify-between gap-3 border-[#fbbf24]/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#182033] border border-[#fbbf24]/30 text-[#fbbf24] shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold text-white truncate">
              Optimal Burn Discipline
            </p>
            <p className="text-[11px] text-[#9ca3af] truncate mt-0.5">
              Runway projected to surplus {rupees(balance >= 0 ? balance : 0)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExporting}
          data-testid="button-spendly-audit-pdf"
          className="shrink-0 rounded-full border border-[#fbbf24]/50 bg-[#151c2e] hover:bg-[#1f2940] px-3.5 py-1.5 text-xs font-bold text-[#fde68a] tracking-wider transition active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {isExporting ? 'GENERATING...' : 'AUDIT PDF'}
        </button>
      </div>
    </div>
  );
}

function SummaryPage({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const { user, profile } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [isExporting, setIsExporting] = useState(false);

  const salary = finance.store.salaries[selectedMonth] ?? 0;
  const expenses = finance.store.expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth);
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = salary - spent;

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Valued User');
  const userEmail = user?.email || 'private@spendly.local';

  const handleDownloadPdf = () => {
    try {
      setIsExporting(true);
      exportMonthlyExpensePdf({
        userName,
        userEmail,
        monthKey: selectedMonth,
        monthLabel: monthLabel(selectedMonth),
        salary,
        expenses,
        categories: finance.categories,
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate PDF report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page-enter">
      {/* ── SPENDLY MOBILE SUMMARY UI (strictly for phone users < 640px) ── */}
      <div className="sm:hidden">
        <SpendlyMobileSummary
          finance={finance}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          salary={salary}
          spent={spent}
          balance={balance}
          expenses={expenses}
          userName={userName}
          userEmail={userEmail}
          isExporting={isExporting}
          handleDownloadPdf={handleDownloadPdf}
        />
      </div>

      {/* ── DESKTOP SUMMARY UI (strictly for desktop/tablet >= 640px) ── */}
      <div className="hidden sm:block space-y-6">
        <PageIntro
          eyebrow="Visual Analytics & Trends"
          title="Reports & Insights."
          description="Interactive charts, daily spending flows, category allocations, and PDF statements."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                data-testid="button-download-pdf-report"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                title="Download Monthly PDF Expense Report"
              >
                <FileDown className="h-4 w-4" />
                <span>{isExporting ? 'Generating...' : 'Download PDF'}</span>
              </button>
            </div>
          }
        />

        {spent > salary && salary > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-bold text-destructive">This month is over its salary by {rupees(spent - salary)}.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">No shame in the number — it’s simply asking for your attention.</p>
            </div>
          </div>
        )}

        {/* 4 Summary KPIs in 2x2 on phone screens, 4-col on desktop */}
        <div className="rounded-3xl border border-card-border/80 bg-card/60 p-2.5 sm:p-0 sm:border-0 sm:bg-transparent shadow-[var(--shadow-card)] sm:shadow-none backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
            <MetricCard
              testId="summary-salary"
              label="Salary"
              value={salary ? rupees(salary) : 'Not set'}
              detail={salary ? monthLabel(selectedMonth) : 'Add in Settings'}
              icon={Banknote}
              tone="mint"
            />
            <MetricCard
              testId="summary-expenses"
              label="Expenses"
              value={rupees(spent)}
              detail={`${expenses.length} ${expenses.length === 1 ? 'transaction' : 'transactions'}`}
              icon={CreditCard}
              tone="coral"
            />
            <MetricCard
              testId="summary-balance"
              label={balance < 0 ? 'Over by' : 'Balance'}
              value={rupees(Math.abs(balance))}
              detail={balance < 0 ? 'Needs closer look' : 'Available after expenses'}
              icon={balance < 0 ? ArrowDownRight : ArrowUpRight}
              tone={balance < 0 ? 'coral' : 'cream'}
            />
            <MetricCard
              testId="summary-average"
              label="Avg per tx"
              value={expenses.length ? rupees(spent / expenses.length) : '₹0'}
              detail="Per transaction"
              icon={TrendingDown}
              tone="plum"
            />
          </div>
        </div>

        {/* Interactive Visual Analytics Charts & Insights */}
        <ReportCharts
          expenses={expenses}
          salary={salary}
          selectedMonth={selectedMonth}
          categories={finance.categories}
          categoryColors={CATEGORY_COLORS}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              data-testid="button-download-pdf-bottom"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              <span>{isExporting ? 'Generating PDF...' : `Download ${monthLabel(selectedMonth)} Report (PDF)`}</span>
            </button>
            <Link
              href="/expenses"
              data-testid="link-summary-transactions"
              className="inline-flex items-center gap-2 rounded-xl bg-card border border-card-border px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted"
            >
              <span>View All Transactions</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
            </Link>
          </div>
          <Link
            href="/add-expense"
            className="inline-flex items-center gap-1.5 rounded-xl bg-muted border border-border px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-card"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>Add Expense</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SpendlyMobileSettings({
  finance,
  theme,
  toggleTheme,
}: {
  finance: ReturnType<typeof useFinance>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user, profile, signOut, isConfigured } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [salaryValue, setSalaryValue] = useState(String(finance.store.salaries[selectedMonth] ?? ''));
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    setSalaryValue(finance.store.salaries[selectedMonth] ? String(finance.store.salaries[selectedMonth]) : '');
  }, [finance.store.salaries, selectedMonth]);

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Guest User');

  const userInitial = userName ? userName[0].toUpperCase() : 'G';

  const handleSaveSalary = (e: FormEvent) => {
    e.preventDefault();
    if (Number(salaryValue) > 0) {
      finance.setSalary(selectedMonth, Number(salaryValue));
    }
  };

  const handleAddCategory = (e: FormEvent) => {
    e.preventDefault();
    if (finance.addCategory(newCategory)) {
      setNewCategory('');
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs font-semibold text-[#9ca3af] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_6px_#fbbf24]" />
            Account & Preferences
          </p>
          <h1 className="text-xl font-serif font-extrabold text-[#f1f5f3] tracking-tight mt-0.5">
            Profile & Settings<span className="text-[#fbbf24]">.</span>
          </h1>
        </div>
      </div>

      {/* ── VIP DIGITAL MEMBER PROFILE CARD ── */}
      <div className="spendly-credit-card !p-4">
        <div className="spendly-credit-card__sheen" />
        <div className="spendly-credit-card__mesh-pattern" />

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Glowing Avatar */}
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#d97706] to-[#fbbf24] text-lg font-black text-[#080c14] shadow-[0_0_16px_rgba(245,158,11,0.5)] ring-2 ring-[#fbbf24] ring-offset-2 ring-offset-[#080c14]">
              {userInitial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-white tracking-tight truncate">
                  {userName}
                </h2>
                <span className="rounded-full bg-[#1e1c12] border border-[#fbbf24]/40 px-1.5 py-0.2 text-[7.5px] font-extrabold uppercase tracking-wider text-[#fde68a]">
                  PRIVATE WEALTH
                </span>
              </div>
              <p className="text-[11px] text-[#fde68a]/80 truncate font-mono mt-0.5">
                {isRealSupabaseUser(user) ? user?.email : 'Offline Guest Mode'}
              </p>
            </div>
          </div>

          {/* Overlapping Hologram Circles */}
          <div className="spendly-card-network opacity-80 shrink-0" title="Spendly Network">
            <div className="spendly-card-network__circle spendly-card-network__circle--1" />
            <div className="spendly-card-network__circle spendly-card-network__circle--2" />
          </div>
        </div>

        {/* Database & Session Status Row */}
        <div className="relative z-10 mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isRealSupabaseUser(user) ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
            <span className={`text-[10.5px] font-semibold ${isRealSupabaseUser(user) ? 'text-emerald-300' : 'text-amber-200/90'}`}>
              {isRealSupabaseUser(user) ? 'Cloud Synced' : 'Private (Offline)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isRealSupabaseUser(user) ? (
              <>
                <button
                  type="button"
                  onClick={finance.syncWithSupabase}
                  disabled={finance.isSyncing}
                  className="rounded-lg bg-[#182033] border border-[#fbbf24]/30 px-2.5 py-1 text-[10px] font-bold text-[#fde68a] flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${finance.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{finance.isSyncing ? 'Syncing...' : 'Sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-lg bg-rose-950/80 border border-rose-400/30 px-2.5 py-1 text-[10px] font-bold text-rose-300 flex items-center gap-1 transition active:scale-95"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={signOut}
                  title="Reset local guest data and return to login"
                  className="rounded-lg bg-[#182033] border border-white/15 px-2.5 py-1 text-[10px] font-bold text-neutral-300 flex items-center gap-1 transition active:scale-95 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-400/30"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Sign Out</span>
                </button>
                <Link
                  href="/login"
                  className="rounded-lg bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-2.5 py-1 text-[10px] font-bold text-[#080c14] flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.35)] transition active:scale-95"
                >
                  <LogIn className="h-3 w-3" />
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MONTHLY TAKE-HOME SALARY CARD ── */}
      <div className="spendly-glass-card space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20">
              <Banknote className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f1f5f3]">Monthly Take-Home</p>
              <p className="text-[10px] text-[#9ca3af]">Calculates budget and savings pace</p>
            </div>
          </div>

          {/* Month Selector Dropdown Pill */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-full bg-[#101626] border border-[#fbbf24]/25 px-2.5 py-1 pr-6 text-[10px] font-bold text-[#fde68a] outline-none"
            >
              {getMonthOptions(selectedMonth).map((m) => (
                <option key={m} value={m} className="bg-[#0b0f19] text-[#f1f5f3]">
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-[#fbbf24]" />
          </div>
        </div>

        <form onSubmit={handleSaveSalary} className="flex gap-2 pt-0.5">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#fbbf24]">₹</span>
            <input
              type="number"
              min="0"
              value={salaryValue}
              onChange={(e) => setSalaryValue(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-xl bg-[#101626] border border-[#fbbf24]/25 py-2 pl-7 pr-3 text-xs font-semibold text-[#f1f5f3] outline-none focus:border-[#fbbf24]"
            />
          </div>
          <button
            type="submit"
            disabled={!Number(salaryValue)}
            className="rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-3.5 py-2 text-xs font-bold text-[#080c14] shadow-[0_0_12px_rgba(245,158,11,0.35)] transition active:scale-95 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </div>

      {/* ── CUSTOM CATEGORIES CARD ── */}
      <div className="spendly-glass-card space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f5f3]">Manage Categories</p>
            <p className="text-[10px] text-[#9ca3af]">Custom tags and everyday buckets</p>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {finance.categories.map((cat) => {
            const Icon = getCategoryIcon(cat);
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#101626] border border-[#fbbf24]/20 px-2.5 py-1 text-[11px] font-semibold text-[#fde68a] transition-all hover:border-[#fbbf24]/40"
              >
                <Icon className="h-3 w-3 text-[#fbbf24]" />
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() => finance.removeCategory(cat)}
                  className="ml-0.5 rounded-full p-0.5 text-[#9ca3af] hover:text-[#f87171] hover:bg-rose-950/40 transition active:scale-90"
                  title={`Delete ${cat}`}
                  aria-label={`Delete ${cat}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 pt-0.5">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Add new category..."
            className="flex-1 rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-3 py-2 text-xs font-medium text-[#f1f5f3] outline-none focus:border-[#fbbf24]"
          />
          <button
            type="submit"
            disabled={!newCategory.trim()}
            className="rounded-xl bg-[#182033] border border-[#fbbf24]/30 px-3.5 py-2 text-xs font-bold text-[#fbbf24] transition active:scale-95 disabled:opacity-50"
          >
            + Add
          </button>
        </form>
      </div>

      {/* ── THEME & DISPLAY PREFERENCES ── */}
      <div className="spendly-glass-card space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20">
              <Smartphone className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f1f5f3]">Theme Mode</p>
              <p className="text-[10px] text-[#9ca3af]">Currently {theme} mode</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101626] border border-[#fbbf24]/25 px-3 py-1.5 text-xs font-bold text-[#f1f5f3] transition active:scale-95"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[#fbbf24]" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({
  finance,
  theme,
  toggleTheme,
}: {
  finance: ReturnType<typeof useFinance>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user, profile, signOut, isConfigured } = useAuth();
  const [month, setMonth] = useState(monthKey());
  const [salary, setSalaryValue] = useState(String(finance.store.salaries[month] ?? ''));
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    setSalaryValue(finance.store.salaries[month] ? String(finance.store.salaries[month]) : '');
  }, [finance.store.salaries, month]);

  const save = () => {
    if (Number(salary) > 0) finance.setSalary(month, Number(salary));
  };

  return (
    <div className="page-enter">
      {/* ── SPENDLY MOBILE SETTINGS / PROFILE UI (strictly for phone users < 640px) ── */}
      <div className="sm:hidden">
        <SpendlyMobileSettings
          finance={finance}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      </div>

      {/* ── DESKTOP SETTINGS UI (strictly for desktop/tablet >= 640px) ── */}
      <div className="hidden sm:block mx-auto max-w-4xl space-y-6 sm:pb-16">
        <PageIntro eyebrow="Your space" title="Settings." description="Keep your monthly context, private categories, and app preferences up to date." />

        {/* Account & Supabase Authentication */}
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl">Account & Cloud Sync</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user
                  ? `Signed in as ${user.email}. Database is actively connected.`
                  : 'Connect your Supabase account to sync your expenses securely across all your devices.'}
              </p>
            </div>
          </div>
          {isRealSupabaseUser(user) && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" /> Supabase Connected
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-sm">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : <UserIcon className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-sm font-bold">
                {profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Guest / Offline Mode'}
              </p>
              <p className="text-xs text-muted-foreground">
                {user
                  ? `Active session · ${user.email}`
                  : isConfigured
                  ? 'Ready to connect with your Supabase account'
                  : 'Add Supabase keys in .env to connect'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRealSupabaseUser(user) && (
              <button
                type="button"
                onClick={finance.syncWithSupabase}
                disabled={finance.isSyncing}
                data-testid="button-settings-sync"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${finance.isSyncing ? 'animate-spin' : ''}`} />
                {finance.isSyncing ? 'Syncing...' : 'Sync with DB'}
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={signOut}
                data-testid="button-settings-signout"
                className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/20"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <Link
                href="/login"
                data-testid="button-settings-login"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
              >
                <LogIn className="h-4 w-4" /> Sign In / Create Account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Salary Configuration */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e0e7ff] text-primary dark:bg-[#1e1b4b] dark:text-[#c7d2fe]">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">Monthly salary</h2>
            <p className="mt-1 text-sm text-muted-foreground">Salary lives month by month, so a changing month never changes your history.</p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <Field label="Month">
            <MonthPicker value={month} onChange={setMonth} />
          </Field>
          <Field label="Take-home salary">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-ui text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                min="0"
                value={salary}
                onChange={(e) => setSalaryValue(e.target.value)}
                placeholder="0"
                data-testid="input-settings-salary"
                className="pl-8"
              />
            </div>
          </Field>
          <Button onClick={save} disabled={!Number(salary)} testId="button-save-settings-salary">
            <Check className="h-4 w-4" /> Save salary
          </Button>
        </div>
      </section>

      {/* Categories */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e6ddea] text-[#6f567a] dark:bg-[#34243d] dark:text-[#d9c4e2]">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">Categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your everyday buckets, plus any that make sense for your life.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {finance.categories.map((category) => (
            <span key={category} className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold">
              {category}
              <button
                type="button"
                aria-label={`Remove ${category}`}
                data-testid={`button-remove-category-${category}`}
                onClick={() => finance.removeCategory(category)}
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-6 flex max-w-md gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Add a custom category"
            data-testid="input-settings-category"
          />
          <Button
            onClick={() => {
              if (finance.addCategory(newCategory)) setNewCategory('');
            }}
            disabled={!newCategory.trim()}
            testId="button-add-category"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      {/* App & Display Preferences */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">App & Display</h2>
            <p className="mt-1 text-sm text-muted-foreground">Customize appearance and install Spendly on your device.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
            <div>
              <p className="text-sm font-bold">Theme mode</p>
              <p className="text-xs text-muted-foreground capitalize">Currently {theme} mode</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold transition hover:bg-muted"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" /> Switch to Light
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" /> Switch to Dark
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
);
}

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const finance = useFinance();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="Spendly Logo"
            className="h-16 w-16 rounded-2xl object-contain shadow-xl animate-pulse"
          />
          <span className="font-display text-xl font-bold tracking-tight">
            spendly<span className="text-accent">.</span>
          </span>
        </div>
      </div>
    );
  }

  // If unauthenticated or navigating to login/signup in guest mode, show LoginPage
  if (!user || location === '/login' || location === '/signup') {
    return (
      <div className="app-grain flex min-h-[100dvh] flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
        <LoginPage />
      </div>
    );
  }

  return (
    <AppShell toast={finance.toast} theme={theme} toggleTheme={toggleTheme}>
      <ErrorBoundary resetKey={location}>
        <Switch>
          <Route path="/" component={() => <HomePage finance={finance} />} />
          <Route path="/expenses" component={() => <ExpensesPage finance={finance} />} />
          <Route path="/add-expense/:id" component={() => <ExpenseFormPage finance={finance} />} />
          <Route path="/add-expense" component={() => <ExpenseFormPage finance={finance} />} />
          <Route path="/summary" component={() => <SummaryPage finance={finance} />} />
          <Route path="/settings" component={() => <SettingsPage finance={finance} theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/login" component={() => <LoginPage />} />
          <Route path="/signup" component={() => <LoginPage />} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;