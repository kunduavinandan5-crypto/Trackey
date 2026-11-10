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
  Clock,
  CreditCard,
  Database,
  Edit3,
  FileDown,
  Film,
  Filter,
  Gauge,
  GraduationCap,
  HandCoins,
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
  fetchUserLending,
  saveLendingToDb,
  deleteLendingFromDb,
  fetchUserCash,
  saveCashToDb,
  deleteCashFromDb,
  fetchUserLoans,
  saveLoanToDb,
  deleteLoanFromDb,
  fetchUserEmis,
  saveEmiToDb,
  deleteEmiFromDb,
} from '@/lib/db-service';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_VERSION, checkForAppUpdates, forceAppRefresh, subscribePwa, type PwaStatus } from '@/lib/pwa-update';

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
  if (!key || key === 'ALL' || key === 'all') return 'All Months';
  const parts = key.split('-').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return key;
  const [year, month] = parts;
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

// Expense ids are a global primary key in Supabase, so they must be unguessable.
const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')}`;

// Must stay in sync with the CHECK constraints in supabase-schema.sql
const LIMITS ={ description: 200, category: 60, notes: 1000, amount: 1_000_000_000 } as const;
const isValidAmount = (n: number) => Number.isFinite(n) && n >= 0 && n <= LIMITS.amount;

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

// Custom hook for theme management (defaults to luxurious dark black glass)
function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
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
  const { user, loading: authLoading } = useAuth();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  // Storage key the in-memory `store` belongs to. The persist effect only writes
  // when this matches the current user's key, so one account's data is never
  // written under another account's (or the guest) key during a user switch.
  const storeKeyRef = useRef<string>(getStoreStorageKey(null));

  // Initialize from user-specific localStorage immediately to avoid blank flicker on refresh.
  const [store, setStore] = useState<FinanceStore>(() => {
    if (typeof window === 'undefined') return fallbackStore;
    try {
      // Try to read the saved auth user (set by auth-context on every login)
      const savedUserRaw = localStorage.getItem('spendly_auth_user');
      if (savedUserRaw) {
        const savedUser = JSON.parse(savedUserRaw) as { id?: string };
        if (savedUser?.id && isRealSupabaseUser(savedUser as { id: string })) {
          // Real Supabase user — load their own store
          const userKey = getStoreStorageKey(savedUser.id);
          const userRaw = localStorage.getItem(userKey);
          if (userRaw) {
            storeKeyRef.current = userKey;
            return parseStore(userRaw);
          }
        }
      }
      // Guest / fallback store
      const guestRaw = localStorage.getItem('spendly-store-guest');
      if (guestRaw) return parseStore(guestRaw);
      const legacy = findExistingLegacyStore();
      if (legacy) return legacy;
    } catch {}
    return fallbackStore;
  });

  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'danger' } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  // Helper to set isSyncing without causing redundant re-renders
  const setSyncState = (val: boolean) => {
    if (isSyncingRef.current !== val) {
      isSyncingRef.current = val;
      setIsSyncing(val);
    }
  };

  // Ref to suppress realtime events triggered by our OWN local writes
  const localChangePendingRef = useRef<number>(0);
  // Debounce timer for realtime events
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = getStoreStorageKey(user?.id);
    if (key !== storeKeyRef.current) return;
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
    // Don't swap stores while the session is still being restored — the cached
    // user store loaded at init is correct and switching to guest would flicker.
    if (authLoading) return;

    if (!user || !isRealSupabaseUser(user)) {
      // Guest mode: load guest-specific local store
      storeKeyRef.current = getStoreStorageKey(null);
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

      setSyncState(true);
      try {
        // 1. Check if there are any offline/guest expenses to migrate to this Supabase account
        const guestRaw = localStorage.getItem('spendly-store-guest');
        if (guestRaw) {
          const guestStore = parseStore(guestRaw);
          if (guestStore.expenses.length > 0 || Object.keys(guestStore.salaries).length > 0) {
            let allSaved = true;
            for (const exp of guestStore.expenses) {
              if (!(await saveExpenseToDb(userId, exp))) allSaved = false;
            }
            for (const [m, amt] of Object.entries(guestStore.salaries)) {
              if (!(await saveSalaryToDb(userId, m, amt))) allSaved = false;
            }
            // Keep the guest data if anything failed so it isn't silently lost
            if (allSaved) localStorage.removeItem('spendly-store-guest');
          }
        }

        // 2. Fetch remote expenses & salaries from Supabase
        const [remoteExpenses, remoteSalaries] = await Promise.all([
          fetchUserExpenses(userId),
          fetchUserSalaries(userId),
        ]);

        if (cancelled) return;

        // If remote query failed completely (network / RLS error), DO NOT wipe local store!
        if (remoteExpenses === null) {
          console.warn('[Supabase] Could not fetch remote expenses; retaining local cache.');
          return;
        }

        setStore((currentStore) => {
          // Read cached local store for this user
          const userLocalRaw = localStorage.getItem(getStoreStorageKey(userId));
          // Only fall back to the in-memory store if it actually belongs to this user
          const userLocal = userLocalRaw
            ? parseStore(userLocalRaw)
            : storeKeyRef.current === getStoreStorageKey(userId)
              ? currentStore
              : null;

          const remoteList: Expense[] = remoteExpenses.map((e) => ({
            id: e.id,
            amount: Number(e.amount),
            description: e.description,
            category: e.category,
            date: e.date,
            notes: e.notes || '',
          }));

          const remoteMap = new Map(remoteList.map((e) => [e.id, e]));

          // Push any local-only expenses to Supabase if not yet on remote
          (userLocal?.expenses || []).forEach((localExp) => {
            if (!remoteMap.has(localExp.id)) {
              saveExpenseToDb(userId, localExp);
              remoteMap.set(localExp.id, localExp);
            }
          });

          const mergedExpenses = Array.from(remoteMap.values()).sort((a, b) => b.date.localeCompare(a.date));

          const remoteSalaryMap = remoteSalaries || {};
          const mergedSalaries: Record<string, number> = { ...(userLocal?.salaries || {}), ...remoteSalaryMap };
          Object.entries(userLocal?.salaries || {}).forEach(([m, amt]) => {
            if (remoteSalaryMap[m] === undefined) {
              saveSalaryToDb(userId, m, amt);
            }
          });

          const finalStore: FinanceStore = {
            expenses: mergedExpenses,
            salaries: mergedSalaries,
            categories: userLocal?.categories && userLocal.categories.length > 0 ? userLocal.categories : [...BASE_CATEGORIES],
            customCategories: userLocal?.customCategories || [],
          };

          storeKeyRef.current = getStoreStorageKey(userId);
          localStorage.setItem(storeKeyRef.current, JSON.stringify(finalStore));
          return finalStore;
        });
      } catch (err) {
        console.warn('[Supabase] Sync exception:', err);
      } finally {
        if (!cancelled) setSyncState(false);
      }
    };

    // 1. If user switched, load their cached data — never keep showing the previous user's store
    if (userChanged && storeKeyRef.current !== getStoreStorageKey(userId)) {
      const cachedRaw = localStorage.getItem(getStoreStorageKey(userId));
      storeKeyRef.current = getStoreStorageKey(userId);
      setStore(cachedRaw ? parseStore(cachedRaw) : fallbackStore);
    }

    // 2. Fetch latest data from Supabase
    loadSupabaseData('initial');

    // 3. Realtime channel — debounced
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
  }, [user?.id, authLoading]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: uid() };
    setStore((current) => {
      const nextExpenses = [newExpense, ...current.expenses];
      const nextStore = { ...current, expenses: nextExpenses };
      localStorage.setItem(getStoreStorageKey(user?.id), JSON.stringify(nextStore));
      return nextStore;
    });
    notify('Expense saved.');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveExpenseToDb(user.id, newExpense).then((ok) => {
        if (!ok) console.warn('[Supabase] Failed to save expense to database:', newExpense.id);
      });
    }
  };

  const updateExpense = (id: string, changes: Omit<Expense, 'id'>) => {
    const updated: Expense = { ...changes, id };
    setStore((current) => {
      const nextExpenses = current.expenses.map((expense) => (expense.id === id ? updated : expense));
      const nextStore = { ...current, expenses: nextExpenses };
      localStorage.setItem(getStoreStorageKey(user?.id), JSON.stringify(nextStore));
      return nextStore;
    });
    notify('Expense updated.');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveExpenseToDb(user.id, updated).then((ok) => {
        if (!ok) console.warn('[Supabase] Failed to update expense in database:', id);
      });
    }
  };

  const deleteExpense = (id: string) => {
    setStore((current) => {
      const nextExpenses = current.expenses.filter((expense) => expense.id !== id);
      const nextStore = { ...current, expenses: nextExpenses };
      localStorage.setItem(getStoreStorageKey(user?.id), JSON.stringify(nextStore));
      return nextStore;
    });
    notify('Expense removed.', 'danger');

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      deleteExpenseFromDb(user.id, id).then((ok) => {
        if (!ok) console.warn('[Supabase] Failed to delete expense from database:', id);
      });
    }
  };

  const setSalary = (month: string, salary: number) => {
    if (!isValidAmount(salary) || !/^\d{4}-\d{2}$/.test(month)) {
      notify('Please enter a valid salary amount.', 'danger');
      return;
    }
    setStore((current) => {
      const nextSalaries = { ...current.salaries, [month]: salary };
      const nextStore = { ...current, salaries: nextSalaries };
      localStorage.setItem(getStoreStorageKey(user?.id), JSON.stringify(nextStore));
      return nextStore;
    });
    notify(`${monthLabel(month)} salary saved.`);

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveSalaryToDb(user.id, month, salary).then((ok) => {
        if (!ok) console.warn('[Supabase] Failed to save salary to database:', month);
      });
    }
  };

  const addSalary = (month: string, amountToAdd: number) => {
    if (!isValidAmount(amountToAdd) || !/^\d{4}-\d{2}$/.test(month) || amountToAdd <= 0) {
      notify('Please enter a valid income amount.', 'danger');
      return;
    }
    let calculatedTotal = amountToAdd;
    let hadPrevious = false;

    setStore((current) => {
      const prevAmount = current.salaries[month] || 0;
      hadPrevious = prevAmount > 0;
      calculatedTotal = prevAmount + amountToAdd;
      const nextSalaries = { ...current.salaries, [month]: calculatedTotal };
      const nextStore = { ...current, salaries: nextSalaries };
      localStorage.setItem(getStoreStorageKey(user?.id), JSON.stringify(nextStore));
      return nextStore;
    });

    if (hadPrevious) {
      notify(`Added ${rupees(amountToAdd)}. Total ${monthLabel(month)} income: ${rupees(calculatedTotal)}`);
    } else {
      notify(`${monthLabel(month)} income saved: ${rupees(calculatedTotal)}`);
    }

    if (user && isRealSupabaseUser(user)) {
      localChangePendingRef.current = Date.now();
      saveSalaryToDb(user.id, month, calculatedTotal).then((ok) => {
        if (!ok) console.warn('[Supabase] Failed to save salary to database:', month);
      });
    }
  };

  const syncWithSupabase = async () => {
    if (!user || !isRealSupabaseUser(user)) {
      notify('Please sign in with a Supabase account to sync.', 'danger');
      return;
    }
    setSyncState(true);
    notify('Syncing data with Supabase...');
    try {
      // 1. Push all local expenses and salaries to Supabase
      for (const exp of store.expenses) {
        await saveExpenseToDb(user.id, exp);
      }
      for (const [m, amt] of Object.entries(store.salaries)) {
        await saveSalaryToDb(user.id, m, amt);
      }
      // 2. Fetch fresh remote data from Supabase
      const [remoteExpenses, remoteSalaries] = await Promise.all([
        fetchUserExpenses(user.id),
        fetchUserSalaries(user.id),
      ]);

      if (remoteExpenses !== null) {
        const remoteList: Expense[] = remoteExpenses.map((e) => ({
          id: e.id,
          amount: Number(e.amount),
          description: e.description,
          category: e.category,
          date: e.date,
          notes: e.notes || '',
        }));
        const remoteMap = new Map(remoteList.map((e) => [e.id, e]));
        store.expenses.forEach((e) => remoteMap.set(e.id, e));
        const mergedExpenses = Array.from(remoteMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        
        const finalStore: FinanceStore = {
          expenses: mergedExpenses,
          salaries: { ...store.salaries, ...(remoteSalaries || {}) },
          categories: store.categories && store.categories.length > 0 ? store.categories : [...BASE_CATEGORIES],
          customCategories: store.customCategories || [],
        };
        setStore(finalStore);
        localStorage.setItem(getStoreStorageKey(user.id), JSON.stringify(finalStore));
      }
      notify('Supabase database is fully synced and up to date!');
    } catch (err) {
      console.warn('[Supabase] Sync error:', err);
      notify('Failed to complete cloud sync.', 'danger');
    } finally {
      setSyncState(false);
    }
  };

  const addCategory = (category: string) => {
    const clean = category.trim().slice(0, LIMITS.category);
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
    notify,
    isSyncing,
    syncWithSupabase,
    addExpense,
    updateExpense,
    deleteExpense,
    setSalary,
    addSalary,
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
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>({
    isChecking: false,
    hasUpdate: false,
    lastChecked: null,
  });

  useEffect(() => {
    return subscribePwa(setPwaStatus);
  }, []);

  const navItems = [
    { href: '/', label: 'HOME', icon: Landmark },
    { href: '/summary', label: 'REPORTS', icon: TrendingUp },
    { href: '/services', label: 'SERVICES', icon: HandCoins },
    { href: '/settings', label: 'PROFILE', icon: UserCog },
  ];

  return (
    <div className="app-grain min-h-[100dvh] bg-background text-foreground transition-colors duration-200">
      {/* PWA Update Banner */}
      {pwaStatus.hasUpdate && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-4 py-1.5 text-xs font-bold text-[#080c14] shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>New update ready!</span>
          <button
            type="button"
            onClick={() => forceAppRefresh()}
            className="rounded-full bg-[#080c14] text-[#fbbf24] px-2.5 py-0.5 text-[10px] font-extrabold uppercase hover:opacity-90 active:scale-95 transition"
          >
            Update
          </button>
        </div>
      )}

      {/* ── Top Header Navigation Bar (Desktop only, hidden on mobile) ── */}
      <header className="sticky top-0 z-50 hidden w-full border-b border-border/40 bg-background/85 backdrop-blur-xl transition-colors sm:block">
        <div className="mx-auto flex h-16 max-w-[1420px] items-center justify-between px-3.5 sm:px-8 lg:px-12">
          {/* Brand Logo & Name */}
          <Brand />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur-md sm:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
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
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1420px] px-3.5 pb-20 pt-3 sm:px-8 sm:pb-16 sm:pt-6 lg:px-12">
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

        {/* Services */}
        <Link
          href="/services"
          data-testid="link-mobile-services"
          className={`spendly-bottom-nav-btn ${location.startsWith('/services') ? 'spendly-bottom-nav-btn--active' : ''}`}
          title="Services"
        >
          <HandCoins className="h-4 w-4" />
          <span>SERVICE</span>
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

function MonthPicker({
  value,
  onChange,
  compact = false,
  expenses,
  allowAll = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  expenses?: Expense[];
  allowAll?: boolean;
}) {
  return (
    <label className={`relative inline-flex items-center ${compact ? 'min-w-[160px]' : 'min-w-[200px]'}`}>
      <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-primary" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid="select-month"
        className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm font-bold text-foreground outline-none transition hover:border-primary focus:border-primary"
      >
        {getMonthOptions(value, expenses, allowAll).map((month) => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
    </label>
  );
}

function getMonthOptions(selected: string, expenses?: Expense[], allowAll: boolean = false) {
  const options = new Set<string>();
  const current = new Date();
  for (let i = -12; i <= 6; i++) {
    options.add(monthKey(new Date(current.getFullYear(), current.getMonth() + i, 1)));
  }
  if (selected && selected !== 'ALL') options.add(selected);
  if (expenses) {
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        options.add(e.date.slice(0, 7));
      }
    });
  }
  const sorted = Array.from(options).sort().reverse();
  return allowAll ? ['ALL', ...sorted] : sorted;
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
  theme,
  toggleTheme,
}: {
  finance: ReturnType<typeof useFinance>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  salary: number;
  spent: number;
  balance: number;
  expenses: Expense[];
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
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
              {getMonthOptions(selectedMonth, finance.store.expenses).map((m) => (
                <option key={m} value={m} className="bg-[#0b0f19] text-[#f3f4f6]">
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#fbbf24]" />
          </div>

          {/* Quick Theme Toggle Button */}
          {toggleTheme && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-[#101626] text-[#fbbf24] shadow-sm transition active:scale-95"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-300" />
              ) : (
                <Moon className="h-4 w-4 text-[#1E3B2F]" />
              )}
            </button>
          )}

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

      {/* ── SKEUOMORPHIC FROSTED WALLET CARD DECK HERO (IMAGE 1 EXACT MATCH) ── */}
      <div className="wallet-card-deck group relative overflow-hidden rounded-[2.25rem] bg-[#121316] border-2 border-white/35 p-3.5 pt-3 pb-3 shadow-[0_22px_55px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.12)] transition-all duration-300">
        {/* Wallet Label at Top Center */}
        <div className="text-center pb-2">
          <p className="text-xs font-semibold tracking-wider text-white/75 font-sans">
            Wallet
          </p>
        </div>

        {/* Layered Card Deck Stack with Frosted Front Pocket */}
        <div className="relative mx-auto w-full h-[230px] sm:h-[250px] flex flex-col justify-end">
          {/* Card 1 (Back Right): Sunset Peach/Pink Mastercard */}
          <div
            className="absolute inset-x-3 top-0 h-[145px] sm:h-[160px] rounded-2xl p-3 shadow-lg border border-white/30 transform rotate-[4deg] translate-x-3 -translate-y-1 transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-[5deg]"
            style={{
              background: 'linear-gradient(135deg, #fce7f3 0%, #f472b6 40%, #fb923c 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              {/* Mastercard circles */}
              <div className="flex -space-x-1.5 drop-shadow-sm">
                <div className="h-4 w-4 rounded-full bg-[#eb001b]" />
                <div className="h-4 w-4 rounded-full bg-[#f79e1b] opacity-95" />
              </div>
            </div>
          </div>

          {/* Card 2 (Middle Left): Frosted White/Silver Visa Card */}
          <div
            className="absolute inset-x-2 top-2 h-[145px] sm:h-[160px] rounded-2xl p-3 shadow-md transform -rotate-[3deg] -translate-x-2 translate-y-0.5 border-2 border-white/70 transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-[4deg]"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #fde68a 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black italic tracking-widest text-[#1a1f71] select-none font-sans drop-shadow-sm">
                VISA
              </span>
            </div>
          </div>

          {/* Card 3 (Foreground): Royal Electric Blue to Indigo Mastercard */}
          <div
            className="absolute inset-x-1 top-4 h-[145px] sm:h-[160px] rounded-2xl p-3 shadow-xl transform translate-y-2 border border-white/45 transition-transform duration-300 group-hover:translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #06b6d4 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5 drop-shadow-sm">
                <div className="h-4 w-4 rounded-full bg-[#eb001b]" />
                <div className="h-4 w-4 rounded-full bg-[#f79e1b] opacity-95" />
              </div>
            </div>
          </div>

          {/* Frosted Glass Pocket / Sleeve (Front) */}
          <div className="relative z-20 rounded-[1.85rem] border border-white/45 bg-gradient-to-b from-white/[0.22] via-[#1a1d24]/90 to-[#0e1014]/98 backdrop-blur-2xl px-4 py-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.45)] text-center transition-all duration-300">
            <p className="text-[11px] font-medium tracking-wide text-white/70">
              Total Balance
            </p>
            <div className="mt-0.5 flex items-baseline justify-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm font-sans" data-testid="spendly-total-balance">
                {rupees(balance)}
              </span>
            </div>

            {/* Income & Expense Badges */}
            <div className="flex items-center justify-center gap-3 pt-2 mt-2 border-t border-white/10 text-[11px]">
              <div className="flex items-center gap-1 font-bold text-emerald-400">
                <ArrowDownLeft className="h-3 w-3 stroke-[2.5]" />
                <span>{rupees(salary)}</span>
              </div>
              <div className="h-2.5 w-[1px] bg-white/20" />
              <div className="flex items-center gap-1 font-bold text-rose-400">
                <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
                <span>{rupees(spent)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section Header */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <h2 className="text-base font-bold text-[#f1f5f3] tracking-tight">Transactions</h2>
        <Link
          href="/services"
          data-testid="link-spendly-see-all"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#fbbf24] hover:text-[#fde68a] transition"
        >
          <span>View All</span>
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
              <p className="mt-2.5 text-xs font-bold text-[#e2e8f0]">
                {finance.store.expenses.length > 0
                  ? `No records for ${monthLabel(selectedMonth)}`
                  : 'No transactions recorded yet'}
              </p>
              <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                {finance.store.expenses.length > 0
                  ? `You have ${finance.store.expenses.length} record${finance.store.expenses.length === 1 ? '' : 's'} saved across all months.`
                  : 'Tap the "+" button to record an expense.'}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {finance.store.expenses.length > 0 && (
                  <Link
                    href="/expenses"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#182033] border border-[#fbbf24]/30 px-3 py-1.5 text-xs font-bold text-[#fde68a] transition active:scale-95"
                  >
                    <span>View All ({finance.store.expenses.length})</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setLocation('/add-expense')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-3.5 py-1.5 text-xs font-bold text-[#080c14] shadow-[0_0_14px_rgba(245,158,11,0.35)] transition active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>Add expense</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage({
  finance,
  theme,
  toggleTheme,
}: {
  finance: ReturnType<typeof useFinance>;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}) {
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
          theme={theme}
          toggleTheme={toggleTheme}
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
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} expenses={finance.store.expenses} />
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
            {getMonthOptions(selectedMonth, finance.store.expenses, true).map((m) => (
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

  const monthExpenses =
    selectedMonth === 'ALL'
      ? finance.store.expenses
      : finance.store.expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth);

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
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} compact expenses={finance.store.expenses} allowAll />
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

  const presentIncome = finance.store.salaries[salaryMonth] ?? 0;
  const enteredAmount = Number(amount) || 0;
  const newTotal = presentIncome + enteredAmount;

  const handleSaveIncome = (e: FormEvent) => {
    e.preventDefault();
    if (!enteredAmount || enteredAmount <= 0) return;
    finance.addSalary(salaryMonth, enteredAmount);
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
          {transactionType === 'income' ? (presentIncome > 0 ? 'ADD TO INCOME' : 'ADD INCOME') : 'TOTAL EXPENSE'}
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
      {!editing && (
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
      )}

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

            {/* Income Addition Breakdown */}
            <div className="rounded-xl bg-[#101626]/80 border border-[#fbbf24]/20 p-3 text-xs space-y-2">
              <div className="flex justify-between items-center text-[#9ca3af]">
                <span>Present income:</span>
                <span className="font-bold text-[#f1f5f3]">
                  {presentIncome > 0 ? rupees(presentIncome) : '₹0'}
                </span>
              </div>
              {enteredAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-[#9ca3af]">
                    <span>Amount to add:</span>
                    <span className="font-bold text-[#fbbf24]">+{rupees(enteredAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#fbbf24]/20 flex justify-between items-center">
                    <span className="font-bold text-[#f1f5f3]">New total income:</span>
                    <span className="font-bold text-[#34d399] text-sm">{rupees(newTotal)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!enteredAmount || enteredAmount <= 0}
            className="spendly-neon-btn disabled:opacity-50"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>{presentIncome > 0 ? 'Add to Income' : 'Save Income'}</span>
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
                maxLength={LIMITS.description}
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
                    maxLength={LIMITS.category}
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
                maxLength={LIMITS.notes}
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
  const [desktopType, setDesktopType] = useState<'expense' | 'income'>('expense');
  const [desktopMonth, setDesktopMonth] = useState(monthKey());

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const desktopPresentIncome = finance.store.salaries[desktopMonth] ?? 0;
  const desktopEnteredAmount = Number(amount) || 0;
  const desktopNewTotal = desktopPresentIncome + desktopEnteredAmount;

  const handleDesktopSaveIncome = (e: FormEvent) => {
    e.preventDefault();
    if (!desktopEnteredAmount || desktopEnteredAmount <= 0) return;
    finance.addSalary(desktopMonth, desktopEnteredAmount);
    setLocation('/');
  };

  const valid = Boolean(
    Number(amount) > 0 && isValidAmount(Number(amount)) && description.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const payload = {
      amount: Number(amount),
      description: description.trim().slice(0, LIMITS.description),
      category: category.slice(0, LIMITS.category),
      date,
      notes: notes.trim().slice(0, LIMITS.notes),
    };
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
          <h1 className="mt-2 font-display text-5xl leading-none tracking-[-.045em]">
            {editing
              ? 'Edit expense.'
              : desktopType === 'income'
                ? 'Add income.'
                : 'Add an expense.'}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {desktopType === 'income'
              ? 'Add earnings or salary to your monthly income. It will add to your present income.'
              : 'Keep it simple. You can always add more context later.'}
          </p>
        </div>

        {!editing && (
          <div className="mb-6 flex max-w-xs rounded-2xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setDesktopType('income')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                desktopType === 'income'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Income</span>
            </button>
            <button
              type="button"
              onClick={() => setDesktopType('expense')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                desktopType === 'expense'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Expense</span>
            </button>
          </div>
        )}

        {desktopType === 'income' && !editing ? (
          <form
            onSubmit={handleDesktopSaveIncome}
            className="rounded-3xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8 space-y-6"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Amount to add">
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
                      data-testid="input-income-amount"
                      className="h-16 border-primary/30 bg-primary/[.04] pl-11 font-display text-3xl placeholder:text-muted-foreground/40"
                      autoFocus
                    />
                  </div>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="For Month">
                  <div className="relative">
                    <Select
                      value={desktopMonth}
                      onChange={(e) => setDesktopMonth(e.target.value)}
                      data-testid="select-income-month"
                      className="pr-10"
                    >
                      {getMonthOptions(desktopMonth).map((m) => (
                        <option key={m} value={m}>
                          {monthLabel(m)}
                        </option>
                      ))}
                    </Select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/[.03] p-4 text-sm space-y-2">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Present income for {monthLabel(desktopMonth)}:</span>
                    <span className="font-semibold text-foreground">
                      {desktopPresentIncome > 0 ? rupees(desktopPresentIncome) : '₹0'}
                    </span>
                  </div>
                  {desktopEnteredAmount > 0 && (
                    <>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Amount to add:</span>
                        <span className="font-bold text-primary">+{rupees(desktopEnteredAmount)}</span>
                      </div>
                      <div className="pt-2 border-t border-border flex justify-between items-center">
                        <span className="font-bold text-foreground">New total income:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                          {rupees(desktopNewTotal)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-border pt-6 sm:flex-row">
              <Button variant="quiet" type="button" onClick={() => setLocation('/expenses')} testId="button-cancel-income">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!desktopEnteredAmount || desktopEnteredAmount <= 0}
                testId="button-save-income"
              >
                <Check className="h-4 w-4" />
                {desktopPresentIncome > 0 ? 'Add to Income' : 'Save Income'}
              </Button>
            </div>
          </form>
        ) : (
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
                maxLength={LIMITS.description}
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
                    maxLength={LIMITS.category}
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
                  maxLength={LIMITS.notes}
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
        )}
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

  // Weekly spending breakdown for mini bar chart (W1, W2, W3, W4)
  const weeklySpendBars = useMemo(() => {
    const weeks = [0, 0, 0, 0];
    expenses.forEach((e) => {
      const parts = e.date.split('-');
      const day = parts[2] ? parseInt(parts[2], 10) : 1;
      const idx = Math.min(3, Math.floor((day - 1) / 7));
      weeks[idx] += e.amount;
    });
    const max = Math.max(...weeks, 1);
    return weeks.map((amt, idx) => ({
      label: `W${idx + 1}`,
      amount: amt,
      pct: Math.max(16, Math.round((amt / max) * 100)),
    }));
  }, [expenses]);

  // Day-of-week cadence breakdown for mini activity rhythm (M, T, W, T, F, S, S)
  const dayCadenceBars = useMemo(() => {
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach((e) => {
      const d = new Date(e.date + 'T00:00:00');
      const idx = (d.getDay() + 6) % 7; // Monday = 0
      sums[idx] += e.amount;
    });
    const max = Math.max(...sums, 1);
    return labels.map((label, idx) => ({
      label,
      amount: sums[idx],
      pct: Math.max(16, Math.round((sums[idx] / max) * 100)),
    }));
  }, [expenses]);

  // Cyclic ring geometry
  const cyclicRadius = 24;
  const cyclicCircumference = 2 * Math.PI * cyclicRadius; // ~150.8
  const budgetConsumedOffset = cyclicCircumference - (Math.min(100, Math.max(0, spentPct)) / 100) * cyclicCircumference;
  const surplusPct = salary > 0 ? Math.max(0, Math.min(100, Math.round((Math.max(0, balance) / salary) * 100))) : 0;
  const surplusOffset = cyclicCircumference - (surplusPct / 100) * cyclicCircumference;

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
            {getMonthOptions(selectedMonth, finance.store.expenses).map((m) => (
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

      {/* ── LONG MODERN GLASSMORPHISM TABS (CYCLIC & BAR GRAPHS) ── */}
      <div className="space-y-2.5">
        {/* ── Tab 1: Net Balance & Budget Pacer (Cyclic Graph) ── */}
        <div className="spendly-glass-card !p-4 transition-all duration-300 hover:border-[#fbbf24]/35 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20 shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9ca3af]">
                  Net Balance & Budget Pacer
                </span>
              </div>
              <div>
                <p
                  className={`font-serif text-2xl font-bold tracking-tight ${balance < 0 ? 'text-[#f87171]' : 'text-white'}`}
                  data-testid="mobile-summary-balance"
                >
                  {rupees(Math.abs(balance))}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] mt-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${balance >= 0 ? 'bg-[#34d399]' : 'bg-[#f87171]'}`} />
                  <span className="font-semibold text-white/90">{balance >= 0 ? 'Surplus intact' : 'Deficit alert'}</span>
                  <span className="text-white/20">•</span>
                  <span>{salary ? `${rupees(salary)} Take-Home` : 'Salary not set'}</span>
                </div>
              </div>
            </div>

            {/* Cyclic Graph: Radial Donut Meter */}
            <div className="relative shrink-0 flex flex-col items-center">
              <div className="relative h-16 w-16">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 60 60">
                  <circle
                    cx="30"
                    cy="30"
                    r={cyclicRadius}
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r={cyclicRadius}
                    fill="transparent"
                    stroke="url(#cyclicBudgetGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={cyclicCircumference}
                    strokeDashoffset={budgetConsumedOffset}
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient id="cyclicBudgetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-black text-white leading-none">
                    {spentPct}%
                  </span>
                  <span className="text-[7.5px] uppercase font-extrabold text-[#9ca3af] mt-0.5 tracking-tight">
                    PACER
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab 2: Total Spend & Weekly Trajectory (Bar Graph) ── */}
        <div className="spendly-glass-card !p-4 transition-all duration-300 hover:border-[#fbbf24]/35 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20 shadow-sm">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9ca3af]">
                  Weekly Outflow Trajectory
                </span>
              </div>
              <div>
                <p className="font-serif text-2xl font-bold text-white tracking-tight" data-testid="mobile-summary-expenses">
                  {rupees(spent)}
                </p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">
                  🗂 {expenses.length} {expenses.length === 1 ? 'ledger item' : 'ledger items'} logged • ~{rupees(dailyRunway)}/day pace
                </p>
              </div>
            </div>

            {/* Vertical Bar Graph (4 Weeks) */}
            <div className="shrink-0 flex items-end gap-1.5 h-14 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/8">
              {weeklySpendBars.map((bar) => (
                <div key={bar.label} className="flex flex-col items-center gap-1 h-full justify-end" title={`${bar.label}: ${rupees(bar.amount)}`}>
                  <div className="relative w-2.5 rounded-full bg-white/5 overflow-hidden flex flex-col justify-end h-8">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-[#d97706] to-[#fbbf24] transition-all duration-500"
                      style={{ height: `${bar.pct}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-extrabold text-[#9ca3af] leading-none">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab 3: Take-Home & Retention Cycle (Cyclic Graph) ── */}
        <div className="spendly-glass-card !p-4 transition-all duration-300 hover:border-[#fbbf24]/35 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#34d399] border border-[#34d399]/20 shadow-sm">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9ca3af]">
                  Take-Home & Retention
                </span>
              </div>
              <div>
                <p className="font-serif text-2xl font-bold text-white tracking-tight" data-testid="mobile-summary-salary">
                  {salary ? rupees(salary) : 'Not set'}
                </p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">
                  {salary > 0
                    ? `↑ Credited ${monthShortName} 1 • ${surplusPct}% surplus retained (${rupees(Math.max(0, balance))})`
                    : 'Set take-home in Profile to monitor savings retention'}
                </p>
              </div>
            </div>

            {/* Cyclic Graph: Retention Arc */}
            <div className="relative shrink-0 flex flex-col items-center">
              <div className="relative h-16 w-16">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 60 60">
                  <circle
                    cx="30"
                    cy="30"
                    r={cyclicRadius}
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r={cyclicRadius}
                    fill="transparent"
                    stroke="url(#cyclicRetainGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={cyclicCircumference}
                    strokeDashoffset={surplusOffset}
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient id="cyclicRetainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-black text-[#34d399] leading-none">
                    {surplusPct}%
                  </span>
                  <span className="text-[7.5px] uppercase font-extrabold text-[#9ca3af] mt-0.5 tracking-tight">
                    SAVED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab 4: Transaction Cadence & Daily Rhythm (Bar Graph) ── */}
        <div className="spendly-glass-card !p-4 transition-all duration-300 hover:border-[#fbbf24]/35 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#818cf8] border border-[#818cf8]/20 shadow-sm">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9ca3af]">
                  Active Cadence & Daily Rhythm
                </span>
              </div>
              <div>
                <p className="font-serif text-2xl font-bold text-white tracking-tight" data-testid="mobile-summary-average">
                  {expenses.length ? rupees(spent / expenses.length) : '₹0'}
                </p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">
                  ⚡ {activeDaysCount} active spend days • {Math.max(0, daysInMonth - activeDaysCount)} quiet tranquil days
                </p>
              </div>
            </div>

            {/* 7-Day Day-of-Week Rhythm Bar Chart */}
            <div className="shrink-0 flex items-end gap-1 h-14 px-2 py-1.5 rounded-xl bg-black/25 border border-white/8">
              {dayCadenceBars.map((bar, i) => (
                <div key={`${bar.label}-${i}`} className="flex flex-col items-center gap-1 h-full justify-end" title={`${bar.label}: ${rupees(bar.amount)}`}>
                  <div className="relative w-2 rounded-full bg-white/5 overflow-hidden flex flex-col justify-end h-8">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-[#6366f1] to-[#a5b4fc] transition-all duration-500"
                      style={{ height: `${bar.pct}%` }}
                    />
                  </div>
                  <span className="text-[7.5px] font-extrabold text-[#9ca3af] leading-none">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
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
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} expenses={finance.store.expenses} />
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
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>({
    isChecking: false,
    hasUpdate: false,
    lastChecked: null,
  });

  useEffect(() => {
    return subscribePwa(setPwaStatus);
  }, []);

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
            maxLength={LIMITS.category}
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

      {/* ── APP VERSION & PWA UPDATE CARD ── */}
      <div className="spendly-glass-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#182033] text-[#fbbf24] border border-[#fbbf24]/20">
              <RefreshCw className={`h-3.5 w-3.5 ${pwaStatus.isChecking ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f1f5f3]">App Version & Updates</p>
              <p className="text-[10px] text-[#9ca3af]">
                {APP_VERSION} • {pwaStatus.hasUpdate ? 'Update Available' : 'Running latest build'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#10b981]/15 px-2 py-0.5 text-[10px] font-bold text-[#34d399] border border-[#10b981]/25">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] animate-pulse" />
            Live PWA
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            disabled={pwaStatus.isChecking}
            onClick={async () => {
              const res = await checkForAppUpdates();
              finance.notify(res.message, res.updated ? 'success' : undefined);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] py-2 px-3 text-xs font-bold text-[#080c14] transition active:scale-95 disabled:opacity-50 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pwaStatus.isChecking ? 'animate-spin' : ''}`} />
            <span>{pwaStatus.isChecking ? 'Checking...' : 'Check Update'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              finance.notify('Clearing cache and reloading fresh...');
              await forceAppRefresh();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#182033] border border-[#fbbf24]/30 py-2 px-3 text-xs font-bold text-[#fde68a] transition active:scale-95 hover:bg-[#202942]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#fbbf24]" />
            <span>Force Reload</span>
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
            maxLength={LIMITS.category}
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

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
            <div>
              <p className="text-sm font-bold">App version & updates</p>
              <p className="text-xs text-muted-foreground">{APP_VERSION} • Auto-updates enabled</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await checkForAppUpdates();
                  finance.notify(res.message, res.updated ? 'success' : undefined);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold transition hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Check for updates
              </button>
              <button
                type="button"
                onClick={async () => {
                  finance.notify('Clearing cache and reloading fresh...');
                  await forceAppRefresh();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold transition hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Force reload
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
);
}

const DEFAULT_TITLE = 'Spendly — Personal Expense Tracker & Budget Manager';
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/expenses': 'Expenses',
  '/add-expense': 'Add Expense',
  '/edit-expense': 'Edit Expense',
  '/summary': 'Reports',
  '/settings': 'Settings',
  '/services': 'Services',
  '/signup': 'Create Account',
};

// ─── Finance Services Page with 4 Tables ─────────────────────────────────────
type LendingItem = {
  id: string;
  person: string;
  amount: number;
  type: 'lent' | 'borrowed';
  dueDate: string;
  status: 'pending' | 'settled';
  notes?: string;
};

type CashItem = {
  id: string;
  description: string;
  amount: number;
  type: 'in' | 'out';
  date: string;
  location: string;
  notes?: string;
};

type LoanItem = {
  id: string;
  lender: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  outstanding: number;
  status: 'active' | 'closed';
  notes?: string;
};

type EmiItem = {
  id: string;
  item: string;
  monthlyAmount: number;
  dueDay: number;
  totalInstallments: number;
  remainingInstallments: number;
  autoDebit: boolean;
  status: 'ongoing' | 'completed';
};

function ServicesPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const params = useParams<{ subpage?: string }>();

  // Determine current active subpage from params or URL path
  const currentSubpage = useMemo<'lending' | 'cash' | 'loan' | 'emi' | null>(() => {
    if (params?.subpage && ['lending', 'cash', 'loan', 'emi'].includes(params.subpage)) {
      return params.subpage as 'lending' | 'cash' | 'loan' | 'emi';
    }
    const match = location.match(/^\/services\/(lending|cash|loan|emi)/i);
    if (match) return match[1].toLowerCase() as 'lending' | 'cash' | 'loan' | 'emi';
    return null;
  }, [params?.subpage, location]);

  const isSubpageView = Boolean(currentSubpage);

  const [activeTab, setActiveTab] = useState<'lending' | 'cash' | 'loan' | 'emi'>(() => {
    return currentSubpage || 'lending';
  });

  useEffect(() => {
    if (currentSubpage) {
      setActiveTab(currentSubpage);
    }
  }, [currentSubpage]);

  const [loadingDb, setLoadingDb] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Dedicated Lending Form state
  const [lendingForm, setLendingForm] = useState({
    person: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    type: 'lent' as 'lent' | 'borrowed',
    notes: '',
  });

  // Dedicated Cash Form state
  const [cashForm, setCashForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'out' as 'in' | 'out',
    location: 'Wallet',
    notes: '',
  });

  // Dedicated Loan Form state
  const [loanForm, setLoanForm] = useState({
    lender: '',
    principal: '',
    interestRate: '10',
    tenureMonths: '12',
    outstanding: '',
    notes: '',
  });

  // Dedicated EMI Form state
  const [emiForm, setEmiForm] = useState({
    item: '',
    monthlyAmount: '',
    dueDay: '5',
    totalInstallments: '12',
    remainingInstallments: '12',
    autoDebit: true,
    notes: '',
  });

  // Storage key prefix per user (or guest)
  const userPrefix = user?.id ? user.id : 'guest';

  // Helper to filter out any old dummy preview records from previous sessions
  const isRealRecord = (item: { id: string }) => !/^(l1|l2|l3|c1|c2|c3|ln1|ln2|e1|e2|e3)$/.test(item.id);

  // 1. Lending State (starts empty, loads real data)
  const [lendingList, setLendingList] = useState<LendingItem[]>(() => {
    try {
      const saved = localStorage.getItem(`spendly_service_lending_${userPrefix}`) || localStorage.getItem('spendly_service_lending');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(isRealRecord);
      }
    } catch {}
    return [];
  });

  // 2. Cash State (starts empty, loads real data)
  const [cashList, setCashList] = useState<CashItem[]>(() => {
    try {
      const saved = localStorage.getItem(`spendly_service_cash_${userPrefix}`) || localStorage.getItem('spendly_service_cash');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(isRealRecord);
      }
    } catch {}
    return [];
  });

  // 3. Loans State (starts empty, loads real data)
  const [loanList, setLoanList] = useState<LoanItem[]>(() => {
    try {
      const saved = localStorage.getItem(`spendly_service_loans_${userPrefix}`) || localStorage.getItem('spendly_service_loans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(isRealRecord);
      }
    } catch {}
    return [];
  });

  // 4. EMI State (starts empty, loads real data)
  const [emiList, setEmiList] = useState<EmiItem[]>(() => {
    try {
      const saved = localStorage.getItem(`spendly_service_emis_${userPrefix}`) || localStorage.getItem('spendly_service_emis');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(isRealRecord);
      }
    } catch {}
    return [];
  });

  // Sync with Supabase on mount / user change
  useEffect(() => {
    if (!user || !isRealSupabaseUser(user)) return;
    let isCancelled = false;
    setLoadingDb(true);

    Promise.all([
      fetchUserLending(user.id),
      fetchUserCash(user.id),
      fetchUserLoans(user.id),
      fetchUserEmis(user.id),
    ]).then(([remoteLending, remoteCash, remoteLoans, remoteEmis]) => {
      if (isCancelled) return;
      setLoadingDb(false);

      if (remoteLending !== null) {
        const mapped: LendingItem[] = remoteLending.map((l) => ({
          id: l.id,
          person: l.person_name,
          amount: Number(l.amount),
          type: l.type,
          dueDate: l.due_date || '',
          status: l.status === 'settled' ? 'settled' : 'pending',
          notes: l.notes || '',
        }));
        setLendingList(mapped);
        localStorage.setItem(`spendly_service_lending_${user.id}`, JSON.stringify(mapped));
      }

      if (remoteCash !== null) {
        const mapped: CashItem[] = remoteCash.map((c) => ({
          id: c.id,
          description: c.description,
          amount: Number(c.amount),
          type: c.type,
          date: c.date,
          location: c.wallet_location || 'Wallet',
          notes: c.notes || '',
        }));
        setCashList(mapped);
        localStorage.setItem(`spendly_service_cash_${user.id}`, JSON.stringify(mapped));
      }

      if (remoteLoans !== null) {
        const mapped: LoanItem[] = remoteLoans.map((ln) => ({
          id: ln.id,
          lender: ln.lender_name,
          principal: Number(ln.principal_amount),
          interestRate: Number(ln.interest_rate),
          tenureMonths: Number(ln.tenure_months),
          outstanding: Number(ln.outstanding_balance),
          status: ln.status,
          notes: ln.notes || '',
        }));
        setLoanList(mapped);
        localStorage.setItem(`spendly_service_loans_${user.id}`, JSON.stringify(mapped));
      }

      if (remoteEmis !== null) {
        const mapped: EmiItem[] = remoteEmis.map((e) => ({
          id: e.id,
          item: e.loan_or_item,
          monthlyAmount: Number(e.monthly_amount),
          dueDay: Number(e.due_day),
          totalInstallments: Number(e.total_installments),
          remainingInstallments: Number(e.remaining_installments),
          autoDebit: Boolean(e.auto_debit),
          status: e.status,
        }));
        setEmiList(mapped);
        localStorage.setItem(`spendly_service_emis_${user.id}`, JSON.stringify(mapped));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  // Persist local cache
  useEffect(() => {
    localStorage.setItem(`spendly_service_lending_${userPrefix}`, JSON.stringify(lendingList));
  }, [lendingList, userPrefix]);

  useEffect(() => {
    localStorage.setItem(`spendly_service_cash_${userPrefix}`, JSON.stringify(cashList));
  }, [cashList, userPrefix]);

  useEffect(() => {
    localStorage.setItem(`spendly_service_loans_${userPrefix}`, JSON.stringify(loanList));
  }, [loanList, userPrefix]);

  useEffect(() => {
    localStorage.setItem(`spendly_service_emis_${userPrefix}`, JSON.stringify(emiList));
  }, [emiList, userPrefix]);

  const services = [
    {
      id: 'lending' as const,
      label: 'Lending',
      icon: HandCoins,
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.12)',
      count: lendingList.length,
      desc: 'Track money you lent to friends or family',
      tag: 'Lend & Recover',
    },
    {
      id: 'cash' as const,
      label: 'Cash',
      icon: Banknote,
      color: '#34d399',
      glow: 'rgba(52,211,153,0.12)',
      count: cashList.length,
      desc: 'Monitor physical cash flow and balances',
      tag: 'Cash Flow',
    },
    {
      id: 'loan' as const,
      label: 'Loan',
      icon: CircleDollarSign,
      color: '#f87171',
      glow: 'rgba(248,113,113,0.12)',
      count: loanList.length,
      desc: 'Manage active loans and repayment schedules',
      tag: 'Loan Tracker',
    },
    {
      id: 'emi' as const,
      label: 'EMI',
      icon: CalendarDays,
      color: '#818cf8',
      glow: 'rgba(129,140,248,0.12)',
      count: emiList.length,
      desc: 'View and track all your EMI obligations',
      tag: 'Monthly Dues',
    },
  ];

  const currentService = services.find((s) => s.id === activeTab) || services[0];

  // Calculations for stats — 100% computed from real records
  const totalLent = lendingList.filter(l => l.type === 'lent' && l.status === 'pending').reduce((s, l) => s + l.amount, 0);
  const totalBorrowed = lendingList.filter(l => l.type === 'borrowed' && l.status === 'pending').reduce((s, l) => s + l.amount, 0);

  const cashIn = cashList.filter(c => c.type === 'in').reduce((s, c) => s + c.amount, 0);
  const cashOut = cashList.filter(c => c.type === 'out').reduce((s, c) => s + c.amount, 0);
  const cashBalance = cashIn - cashOut;

  const totalOutstandingLoan = loanList.filter(l => l.status === 'active').reduce((s, l) => s + l.outstanding, 0);
  const totalMonthlyEmi = emiList.filter(e => e.status === 'ongoing').reduce((s, e) => s + e.monthlyAmount, 0);

  // 1. Lending Form Submission — saves to Local + Supabase DB
  const handleLendingFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const person = lendingForm.person.trim();
    const amount = Number(lendingForm.amount);
    if (!person || !amount || amount <= 0) return;

    const newItem: LendingItem = {
      id: uid(),
      person,
      amount,
      type: lendingForm.type,
      dueDate: lendingForm.dueDate || new Date().toISOString().slice(0, 10),
      status: 'pending',
      notes: lendingForm.notes.trim(),
    };

    setLendingList([newItem, ...lendingList]);
    if (user && isRealSupabaseUser(user)) {
      saveLendingToDb(user.id, {
        id: newItem.id,
        person_name: newItem.person,
        amount: newItem.amount,
        type: newItem.type,
        due_date: newItem.dueDate,
        status: newItem.status,
        notes: newItem.notes,
      });
    }

    setLendingForm({
      person: '',
      amount: '',
      dueDate: new Date().toISOString().slice(0, 10),
      type: 'lent',
      notes: '',
    });
    setSaveSuccessMsg(`Saved entry for "${newItem.person}" (${rupees(newItem.amount)}) directly to database in lending table!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      if (isSubpageView) {
        setLocation('/services');
      }
    }, 1200);
  };

  // 2. Cash Form Submission
  const handleCashFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const description = cashForm.description.trim();
    const amount = Number(cashForm.amount);
    if (!description || !amount || amount <= 0) return;

    const newItem: CashItem = {
      id: uid(),
      description,
      amount,
      type: cashForm.type,
      date: cashForm.date || new Date().toISOString().slice(0, 10),
      location: cashForm.location.trim() || 'Wallet',
      notes: cashForm.notes.trim(),
    };

    setCashList([newItem, ...cashList]);
    if (user && isRealSupabaseUser(user)) {
      saveCashToDb(user.id, {
        id: newItem.id,
        description: newItem.description,
        amount: newItem.amount,
        type: newItem.type,
        date: newItem.date,
        wallet_location: newItem.location,
        notes: newItem.notes,
      });
    }

    setCashForm({
      description: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      type: 'out',
      location: 'Wallet',
      notes: '',
    });
    setSaveSuccessMsg(`Saved cash transaction "${newItem.description}" (${rupees(newItem.amount)}) to database!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      if (isSubpageView) {
        setLocation('/services');
      }
    }, 1200);
  };

  // 3. Loan Form Submission
  const handleLoanFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const lender = loanForm.lender.trim();
    const principal = Number(loanForm.principal);
    if (!lender || !principal || principal <= 0) return;

    const outstanding = Number(loanForm.outstanding) > 0 ? Number(loanForm.outstanding) : principal;
    const newItem: LoanItem = {
      id: uid(),
      lender,
      principal,
      interestRate: Number(loanForm.interestRate) || 10,
      tenureMonths: Number(loanForm.tenureMonths) || 12,
      outstanding,
      status: 'active',
      notes: loanForm.notes.trim(),
    };

    setLoanList([newItem, ...loanList]);
    if (user && isRealSupabaseUser(user)) {
      saveLoanToDb(user.id, {
        id: newItem.id,
        lender_name: newItem.lender,
        principal_amount: newItem.principal,
        interest_rate: newItem.interestRate,
        tenure_months: newItem.tenureMonths,
        outstanding_balance: newItem.outstanding,
        status: newItem.status,
        notes: newItem.notes,
      });
    }

    setLoanForm({
      lender: '',
      principal: '',
      interestRate: '10',
      tenureMonths: '12',
      outstanding: '',
      notes: '',
    });
    setSaveSuccessMsg(`Saved loan "${newItem.lender}" (${rupees(newItem.principal)}) to database!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      if (isSubpageView) {
        setLocation('/services');
      }
    }, 1200);
  };

  // 4. EMI Form Submission
  const handleEmiFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const item = emiForm.item.trim();
    const monthlyAmount = Number(emiForm.monthlyAmount);
    if (!item || !monthlyAmount || monthlyAmount <= 0) return;

    const totalInstallments = Number(emiForm.totalInstallments) || 12;
    const remainingInstallments = Number(emiForm.remainingInstallments) || totalInstallments;
    const newItem: EmiItem = {
      id: uid(),
      item,
      monthlyAmount,
      dueDay: Number(emiForm.dueDay) || 5,
      totalInstallments,
      remainingInstallments,
      autoDebit: emiForm.autoDebit,
      status: 'ongoing',
    };

    setEmiList([newItem, ...emiList]);
    if (user && isRealSupabaseUser(user)) {
      saveEmiToDb(user.id, {
        id: newItem.id,
        loan_or_item: newItem.item,
        monthly_amount: newItem.monthlyAmount,
        due_day: newItem.dueDay,
        total_installments: newItem.totalInstallments,
        remaining_installments: newItem.remainingInstallments,
        auto_debit: newItem.autoDebit,
        status: newItem.status,
      });
    }

    setEmiForm({
      item: '',
      monthlyAmount: '',
      dueDay: '5',
      totalInstallments: '12',
      remainingInstallments: '12',
      autoDebit: true,
      notes: '',
    });
    setSaveSuccessMsg(`Saved EMI schedule "${newItem.item}" (${rupees(newItem.monthlyAmount)}/mo) to database!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      if (isSubpageView) {
        setLocation('/services');
      }
    }, 1200);
  };

  // Toggle Lending Status
  const handleToggleLendingStatus = (item: LendingItem) => {
    const updatedStatus = item.status === 'pending' ? 'settled' : 'pending';
    const updated = { ...item, status: updatedStatus as 'pending' | 'settled' };
    setLendingList(lendingList.map((l) => (l.id === item.id ? updated : l)));
    if (user && isRealSupabaseUser(user)) {
      saveLendingToDb(user.id, {
        id: updated.id,
        person_name: updated.person,
        amount: updated.amount,
        type: updated.type,
        due_date: updated.dueDate,
        status: updated.status,
        notes: updated.notes,
      });
    }
  };

  // Delete Lending
  const handleDeleteLending = (id: string) => {
    setLendingList(lendingList.filter((l) => l.id !== id));
    if (user && isRealSupabaseUser(user)) {
      deleteLendingFromDb(user.id, id);
    }
  };

  // Delete Cash
  const handleDeleteCash = (id: string) => {
    setCashList(cashList.filter((c) => c.id !== id));
    if (user && isRealSupabaseUser(user)) {
      deleteCashFromDb(user.id, id);
    }
  };

  // Toggle Loan Status
  const handleToggleLoanStatus = (item: LoanItem) => {
    const updatedStatus = item.status === 'active' ? 'closed' : 'active';
    const updated = { ...item, status: updatedStatus as 'active' | 'closed' };
    setLoanList(loanList.map((l) => (l.id === item.id ? updated : l)));
    if (user && isRealSupabaseUser(user)) {
      saveLoanToDb(user.id, {
        id: updated.id,
        lender_name: updated.lender,
        principal_amount: updated.principal,
        interest_rate: updated.interestRate,
        tenure_months: updated.tenureMonths,
        outstanding_balance: updated.outstanding,
        status: updated.status,
        notes: updated.notes,
      });
    }
  };

  // Delete Loan
  const handleDeleteLoan = (id: string) => {
    setLoanList(loanList.filter((l) => l.id !== id));
    if (user && isRealSupabaseUser(user)) {
      deleteLoanFromDb(user.id, id);
    }
  };

  // Toggle EMI Status
  const handleToggleEmiStatus = (item: EmiItem) => {
    const updatedStatus = item.status === 'ongoing' ? 'completed' : 'ongoing';
    const updated = { ...item, status: updatedStatus as 'ongoing' | 'completed' };
    setEmiList(emiList.map((e) => (e.id === item.id ? updated : e)));
    if (user && isRealSupabaseUser(user)) {
      saveEmiToDb(user.id, {
        id: updated.id,
        loan_or_item: updated.item,
        monthly_amount: updated.monthlyAmount,
        due_day: updated.dueDay,
        total_installments: updated.totalInstallments,
        remaining_installments: updated.remainingInstallments,
        auto_debit: updated.autoDebit,
        status: updated.status,
      });
    }
  };

  // Delete EMI
  const handleDeleteEmi = (id: string) => {
    setEmiList(emiList.filter((e) => e.id !== id));
    if (user && isRealSupabaseUser(user)) {
      deleteEmiFromDb(user.id, id);
    }
  };

  // ── VIEW A: DEDICATED SERVICE FORM (opens on /services/:subpage) ──
  if (isSubpageView) {
    return (
      <div className="page-enter mx-auto w-full max-w-4xl space-y-4 sm:space-y-5 pb-2 sm:pb-6">
        {/* Subpage Header */}
        <div className="flex items-center justify-between pt-1 sm:pt-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocation('/services')}
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-[#111827]/80 border border-white/10 text-[#9ca3af] hover:text-white hover:border-white/20 active:scale-95 transition"
              title="Back to Services"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.16em] text-[#fbbf24] flex items-center gap-1.5">
                <span>Financial Hub / {currentService.label}</span>
                {loadingDb && <span className="text-[9px] text-[#fbbf24]/80 lowercase font-medium tracking-normal animate-pulse">(syncing...)</span>}
              </p>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
                {currentService.label} Tracker
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLocation('/services')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#9ca3af] hover:text-white hover:bg-white/[0.08] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Services</span>
          </button>
        </div>

        {/* Tab Switcher Pills — to switch between service forms */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#0c101c]/90 border border-white/[0.06] p-1 overflow-x-auto">
          {services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => {
                setActiveTab(svc.id);
                setLocation('/services/' + svc.id);
              }}
              className={`flex-1 min-w-[75px] py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 text-center active:scale-95 ${
                activeTab === svc.id
                  ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#080c14] shadow-md shadow-[#fbbf24]/20 tab-pill-pop scale-[1.02]'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {svc.label}
            </button>
          ))}
        </div>

        {/* FORM ONLY — no summary strip, no table */}

        {/* ── LENDING FORM ── */}
        {activeTab === 'lending' && (
          <div key="form-lending" className="tab-pane-enter rounded-2xl border border-white/[0.08] bg-[#0c101c]/90 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24]">
                  <HandCoins className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">Record New Lending Entry</h2>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#34d399]/15 border border-[#34d399]/30 p-3 text-xs font-semibold text-[#34d399]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleLendingFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Person Name */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Person / Contact Name <span className="text-[#fbbf24]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={lendingForm.person}
                      onChange={(e) => setLendingForm({ ...lendingForm, person: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/50 transition"
                    />
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Amount (₹) <span className="text-[#fbbf24]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#fbbf24]">₹</span>
                    <input
                      required
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 5000"
                      value={lendingForm.amount}
                      onChange={(e) => setLendingForm({ ...lendingForm, amount: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/50 transition font-mono"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Date / Due Date <span className="text-[#fbbf24]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                    </span>
                    <input
                      required
                      type="date"
                      value={lendingForm.dueDate}
                      onChange={(e) => setLendingForm({ ...lendingForm, dueDate: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/50 transition"
                    />
                  </div>
                </div>

                {/* Direction */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Direction
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#111726] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setLendingForm({ ...lendingForm, type: 'lent' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        lendingForm.type === 'lent'
                          ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#080c14] shadow-sm shadow-[#fbbf24]/30'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>I Lent (Give)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLendingForm({ ...lendingForm, type: 'borrowed' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        lendingForm.type === 'borrowed'
                          ? 'bg-[#f87171] text-white shadow-sm shadow-[#f87171]/30'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>I Borrowed (Take)</span>
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner bill split, trip advance, emergency loan"
                    value={lendingForm.notes}
                    onChange={(e) => setLendingForm({ ...lendingForm, notes: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/50 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-5 py-2.5 text-xs font-bold text-[#080c14] shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:opacity-95 active:scale-95 transition"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>+ Save to Lending Table</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── CASH FORM ── */}
        {activeTab === 'cash' && (
          <div key="form-cash" className="tab-pane-enter rounded-2xl border border-white/[0.08] bg-[#0c101c]/90 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#34d399]/15 border border-[#34d399]/30 text-[#34d399]">
                  <Banknote className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">Record Cash Flow Entry</h2>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#34d399]/15 border border-[#34d399]/30 p-3 text-xs font-semibold text-[#34d399]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCashFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Description <span className="text-[#34d399]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. ATM withdrawal, grocery"
                    value={cashForm.description}
                    onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Amount (₹) <span className="text-[#34d399]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#34d399]">₹</span>
                    <input
                      required
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 1500"
                      value={cashForm.amount}
                      onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/50 transition font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Date <span className="text-[#34d399]">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={cashForm.date}
                    onChange={(e) => setCashForm({ ...cashForm, date: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white outline-none focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Flow Direction
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#111726] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setCashForm({ ...cashForm, type: 'out' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        cashForm.type === 'out'
                          ? 'bg-[#f87171] text-white shadow-sm shadow-[#f87171]/30'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>Cash Out (Spent)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashForm({ ...cashForm, type: 'in' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        cashForm.type === 'in'
                          ? 'bg-[#34d399] text-[#080c14] shadow-sm shadow-[#34d399]/30'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>Cash In (Received)</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Storage / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wallet, Safe, Drawer"
                    value={cashForm.location}
                    onChange={(e) => setCashForm({ ...cashForm, location: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner cash tip"
                    value={cashForm.notes}
                    onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#34d399] focus:ring-1 focus:ring-[#34d399]/50 transition"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#34d399] px-5 py-2.5 text-xs font-bold text-[#080c14] shadow-[0_0_15px_rgba(52,211,153,0.3)] hover:opacity-95 active:scale-95 transition"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Save to Cash Table</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── LOAN FORM ── */}
        {activeTab === 'loan' && (
          <div key="form-loan" className="tab-pane-enter rounded-2xl border border-white/[0.08] bg-[#0c101c]/90 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#f87171]/15 border border-[#f87171]/30 text-[#f87171]">
                  <CircleDollarSign className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">Record Loan Entry</h2>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#34d399]/15 border border-[#34d399]/30 p-3 text-xs font-semibold text-[#34d399]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleLoanFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Lender / Institution Name <span className="text-[#f87171]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. HDFC Bank, Personal Loan"
                    value={loanForm.lender}
                    onChange={(e) => setLoanForm({ ...loanForm, lender: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Principal Amount (₹) <span className="text-[#f87171]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#f87171]">₹</span>
                    <input
                      required
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 500000"
                      value={loanForm.principal}
                      onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Outstanding Balance (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#f87171]">₹</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="Leave blank if equals principal"
                      value={loanForm.outstanding}
                      onChange={(e) => setLoanForm({ ...loanForm, outstanding: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 9.5"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 24"
                    value={loanForm.tenureMonths}
                    onChange={(e) => setLoanForm({ ...loanForm, tenureMonths: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Notes / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fixed rate loan"
                    value={loanForm.notes}
                    onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#f87171] focus:ring-1 focus:ring-[#f87171]/50 transition"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#f87171] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(248,113,113,0.3)] hover:opacity-95 active:scale-95 transition"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Save to Loans Table</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── EMI FORM ── */}
        {activeTab === 'emi' && (
          <div key="form-emi" className="tab-pane-enter rounded-2xl border border-white/[0.08] bg-[#0c101c]/90 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#818cf8]/15 border border-[#818cf8]/30 text-[#818cf8]">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">Record EMI Schedule</h2>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#34d399]/15 border border-[#34d399]/30 p-3 text-xs font-semibold text-[#34d399]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleEmiFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Item / Obligation <span className="text-[#818cf8]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. iPhone EMI, Car EMI"
                    value={emiForm.item}
                    onChange={(e) => setEmiForm({ ...emiForm, item: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Monthly EMI (₹) <span className="text-[#818cf8]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#818cf8]">₹</span>
                    <input
                      required
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 4500"
                      value={emiForm.monthlyAmount}
                      onChange={(e) => setEmiForm({ ...emiForm, monthlyAmount: e.target.value })}
                      className="w-full rounded-xl bg-[#111726] border border-white/10 pl-8 pr-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]/50 transition font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Due Day of Month (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 5"
                    value={emiForm.dueDay}
                    onChange={(e) => setEmiForm({ ...emiForm, dueDay: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Total Installments
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    value={emiForm.totalInstallments}
                    onChange={(e) => setEmiForm({ ...emiForm, totalInstallments: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Remaining Installments
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 8"
                    value={emiForm.remainingInstallments}
                    onChange={(e) => setEmiForm({ ...emiForm, remainingInstallments: e.target.value })}
                    className="w-full rounded-xl bg-[#111726] border border-white/10 px-3 py-2.5 text-xs font-medium text-white placeholder-[#6b7280] outline-none focus:border-[#818cf8] focus:ring-1 focus:ring-[#818cf8]/50 transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1">
                    Auto-Debit from Bank
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#111726] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setEmiForm({ ...emiForm, autoDebit: true })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        emiForm.autoDebit
                          ? 'bg-[#34d399] text-[#080c14] shadow-sm shadow-[#34d399]/30'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>Enabled</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmiForm({ ...emiForm, autoDebit: false })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        !emiForm.autoDebit
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      <span>Manual</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#818cf8] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(129,140,248,0.3)] hover:opacity-95 active:scale-95 transition"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Save to EMI Table</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW B: SERVICES HUB (/services) — 4 cards + tab pills + ledger tables. NO FORM. ──
  return (
    <div className="page-enter mx-auto w-full max-w-5xl space-y-4 sm:space-y-6 pb-2 sm:pb-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pt-1 sm:pt-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setLocation('/')}
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-[#111827]/80 border border-white/10 text-[#9ca3af] hover:text-white hover:border-white/20 active:scale-95 transition"
            title="Back to Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.16em] text-[#fbbf24] flex items-center gap-1.5">
              <span>Financial Hub</span>
              {loadingDb && <span className="text-[9px] text-[#fbbf24]/80 lowercase font-medium tracking-normal animate-pulse">(syncing cloud...)</span>}
            </p>
            <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
              Services
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLocation('/services/' + activeTab)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-4 py-2 text-xs font-bold text-[#080c14] shadow-md shadow-[#fbbf24]/20 hover:opacity-95 active:scale-95 transition"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add Entry</span>
        </button>
      </div>

      <p className="text-xs sm:text-sm text-[#9ca3af] -mt-1 sm:-mt-2">
        Manage your lending, cash balance, active loans, and recurring EMI schedules in dedicated tables.
      </p>

      {/* 4 Service Option Cards — clicking opens the dedicated form in a new tab */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {services.map((svc) => {
          const Icon = svc.icon;
          const isSelected = activeTab === svc.id;
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => {
                setActiveTab(svc.id);
                setLocation('/services/' + svc.id);
              }}
              className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4.5 backdrop-blur-xl transition-all duration-300 min-h-[145px] sm:min-h-[165px] text-left active:scale-[0.98] shadow-lg hover:shadow-xl ${
                isSelected
                  ? 'border-2 border-[#fbbf24] shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                  : 'border border-white/[0.06] hover:border-white/[0.18]'
              }`}
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${svc.glow} 0%, rgba(12,16,28,0.85) 75%)`,
              }}
            >
              <div className="flex items-start justify-between w-full">
                <div
                  className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl transition-transform group-hover:scale-105"
                  style={{ background: `${svc.color}18`, border: `1px solid ${svc.color}30` }}
                >
                  <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" style={{ color: svc.color }} />
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: `${svc.color}20`, color: svc.color }}
                >
                  {svc.count} {svc.count === 1 ? 'ITEM' : 'ITEMS'}
                </span>
              </div>
              <div className="my-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>{svc.label}</span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: svc.color }} />
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-[#9ca3af] line-clamp-1">{svc.desc}</p>
              </div>
              <div className="flex items-center pt-0.5">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider"
                  style={{ background: `${svc.color}15`, color: svc.color }}
                >
                  {svc.tag}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Segmented Tab Switcher Pills */}
      <div className="flex items-center gap-1.5 rounded-2xl bg-[#0c101c]/90 border border-white/[0.06] p-1 overflow-x-auto">
        {services.map((svc) => (
          <button
            key={svc.id}
            type="button"
            onClick={() => setActiveTab(svc.id)}
            className={`flex-1 min-w-[75px] py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 text-center active:scale-95 ${
              activeTab === svc.id
                ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#080c14] shadow-md shadow-[#fbbf24]/20 tab-pill-pop scale-[1.02]'
                : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            {svc.label}
          </button>
        ))}
      </div>

      {/* ── SERVICE 1: LENDING ── */}
      {activeTab === 'lending' && (
        <div key="lending" className="tab-pane-enter space-y-4">

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#fbbf24]">To Collect (Lent)</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(totalLent)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#f87171]">To Repay (Borrowed)</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(totalBorrowed)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34d399]">Net Position</p>
              <p className={`text-lg sm:text-xl font-black mt-0.5 ${totalLent - totalBorrowed >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                {rupees(totalLent - totalBorrowed)}
              </p>
            </div>
          </div>

          {/* Table Container — Lending Transactions */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <HandCoins className="h-4.5 w-4.5 text-[#fbbf24]" />
                <h2 className="text-sm sm:text-base font-bold text-white">Lending Transactions</h2>
                <span className="rounded-full bg-[#fbbf24]/15 text-[#fbbf24] text-[10px] font-bold px-2 py-0.5">
                  {lendingList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services/lending')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/30 px-2.5 py-1 text-xs font-bold text-[#fbbf24] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            {lendingList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9ca3af]">
                No lending records yet. Click &quot;+ New&quot; or the Lending card above to record an entry.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f1f5f3]">
                  <thead className="bg-white/[0.02] text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] border-b border-white/[0.04]">
                    <tr>
                      <th className="py-3 px-4">Person</th>
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {lendingList.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          {item.person}
                          {item.notes && <p className="text-[10px] text-[#9ca3af] font-normal">{item.notes}</p>}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase ${
                              item.type === 'lent'
                                ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
                                : 'bg-[#f87171]/15 text-[#f87171]'
                            }`}
                          >
                            {item.type === 'lent' ? 'Lent (Give)' : 'Borrowed (Take)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <span className={item.type === 'lent' ? 'text-[#fbbf24]' : 'text-[#f87171]'}>
                            {item.type === 'lent' ? '+' : '-'}{rupees(item.amount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">
                          {item.dueDate ? shortDate(item.dueDate) : '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleLendingStatus(item)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition ${
                              item.status === 'settled'
                                ? 'bg-[#34d399]/20 text-[#34d399]'
                                : 'bg-white/[0.06] text-[#fde68a] hover:bg-white/[0.1]'
                            }`}
                            title="Click to toggle status"
                          >
                            {item.status === 'settled' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            <span>{item.status}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteLending(item.id)}
                            className="p-1 rounded-lg text-[#9ca3af] hover:text-[#f87171] hover:bg-[#f87171]/10 transition"
                            title="Delete from database"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SERVICE 2: CASH ── */}
      {activeTab === 'cash' && (
        <div key="cash" className="tab-pane-enter space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34d399]">Cash in Hand</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(cashBalance)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34d399]">Total Cash In</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(cashIn)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#f87171]">Total Cash Out</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(cashOut)}</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Banknote className="h-4.5 w-4.5 text-[#34d399]" />
                <h2 className="text-sm sm:text-base font-bold text-white">Cash Transactions</h2>
                <span className="rounded-full bg-[#34d399]/15 text-[#34d399] text-[10px] font-bold px-2 py-0.5">
                  {cashList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services/cash')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#34d399]/10 hover:bg-[#34d399]/20 border border-[#34d399]/30 px-2.5 py-1 text-xs font-bold text-[#34d399] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            {cashList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9ca3af]">
                No cash transactions in database yet. Use the form above to record cash flow.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f1f5f3]">
                  <thead className="bg-white/[0.02] text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] border-b border-white/[0.04]">
                    <tr>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {cashList.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          {item.description}
                          {item.notes && <p className="text-[10px] text-[#9ca3af] font-normal">{item.notes}</p>}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase ${
                              item.type === 'in' ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-[#f87171]/15 text-[#f87171]'
                            }`}
                          >
                            {item.type === 'in' ? 'Cash In (+)' : 'Cash Out (-)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <span className={item.type === 'in' ? 'text-[#34d399]' : 'text-[#f87171]'}>
                            {item.type === 'in' ? '+' : '-'}{rupees(item.amount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">{shortDate(item.date)}</td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">{item.location}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteCash(item.id)}
                            className="p-1 rounded-lg text-[#9ca3af] hover:text-[#f87171] hover:bg-[#f87171]/10 transition"
                            title="Delete from database"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SERVICE 3: LOAN ── */}
      {activeTab === 'loan' && (
        <div key="loan" className="tab-pane-enter space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#f87171]">Outstanding Debt</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(totalOutstandingLoan)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af]">Active Loans</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">
                {loanList.filter(l => l.status === 'active').length}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#34d399]">Debt Free Status</p>
              <p className="text-lg sm:text-xl font-black mt-0.5 text-[#34d399]">
                {totalOutstandingLoan === 0 ? 'Clear (₹0)' : 'Active Repayments'}
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4.5 w-4.5 text-[#f87171]" />
                <h2 className="text-sm sm:text-base font-bold text-white">Active Loans</h2>
                <span className="rounded-full bg-[#f87171]/15 text-[#f87171] text-[10px] font-bold px-2 py-0.5">
                  {loanList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services/loan')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#f87171]/10 hover:bg-[#f87171]/20 border border-[#f87171]/30 px-2.5 py-1 text-xs font-bold text-[#f87171] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            {loanList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9ca3af]">
                No loans in database yet. Use the form above to record your active loans.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f1f5f3]">
                  <thead className="bg-white/[0.02] text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] border-b border-white/[0.04]">
                    <tr>
                      <th className="py-3 px-4">Lender</th>
                      <th className="py-3 px-4">Principal</th>
                      <th className="py-3 px-4">Interest</th>
                      <th className="py-3 px-4">Tenure</th>
                      <th className="py-3 px-4">Outstanding</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {loanList.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                          {item.lender}
                          {item.notes && <p className="text-[10px] text-[#9ca3af] font-normal">{item.notes}</p>}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">{rupees(item.principal)}</td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">{item.interestRate}%</td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">{item.tenureMonths} mo</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#f87171] whitespace-nowrap">
                          {rupees(item.outstanding)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleLoanStatus(item)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition ${
                              item.status === 'active'
                                ? 'bg-[#f87171]/20 text-[#f87171]'
                                : 'bg-[#34d399]/20 text-[#34d399]'
                            }`}
                            title="Click to toggle status in Supabase"
                          >
                            {item.status}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteLoan(item.id)}
                            className="p-1 rounded-lg text-[#9ca3af] hover:text-[#f87171] hover:bg-[#f87171]/10 transition"
                            title="Delete from database"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SERVICE 4: EMI ── */}
      {activeTab === 'emi' && (
        <div key="emi" className="tab-pane-enter space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#818cf8]">Monthly Outflow</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">{rupees(totalMonthlyEmi)}/mo</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af]">Ongoing Subscriptions</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">
                {emiList.filter(e => e.status === 'ongoing').length}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-3.5 backdrop-blur-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#fbbf24]">Auto-Debit Active</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">
                {emiList.filter(e => e.autoDebit && e.status === 'ongoing').length}
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-[#818cf8]" />
                <h2 className="text-sm sm:text-base font-bold text-white">Monthly EMI Schedules</h2>
                <span className="rounded-full bg-[#818cf8]/15 text-[#818cf8] text-[10px] font-bold px-2 py-0.5">
                  {emiList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/services/emi')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#818cf8]/10 hover:bg-[#818cf8]/20 border border-[#818cf8]/30 px-2.5 py-1 text-xs font-bold text-[#818cf8] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            {emiList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9ca3af]">
                No EMI schedules in database yet. Use the form above to record recurring installments.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f1f5f3]">
                  <thead className="bg-white/[0.02] text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] border-b border-white/[0.04]">
                    <tr>
                      <th className="py-3 px-4">Item / Obligation</th>
                      <th className="py-3 px-4">Monthly EMI</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Installments Left</th>
                      <th className="py-3 px-4">Auto-Debit</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {emiList.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">{item.item}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#818cf8] whitespace-nowrap">
                          {rupees(item.monthlyAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">Every {item.dueDay}th</td>
                        <td className="py-3.5 px-4 text-[#9ca3af] whitespace-nowrap">
                          <span className="font-bold text-white">{item.remainingInstallments}</span> / {item.totalInstallments}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase ${
                              item.autoDebit
                                ? 'bg-[#34d399]/15 text-[#34d399]'
                                : 'bg-white/[0.06] text-[#9ca3af]'
                            }`}
                          >
                            {item.autoDebit ? 'Enabled' : 'Manual'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleEmiStatus(item)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition ${
                              item.status === 'ongoing'
                                ? 'bg-[#818cf8]/20 text-[#818cf8]'
                                : 'bg-[#34d399]/20 text-[#34d399]'
                            }`}
                            title="Click to toggle status in Supabase"
                          >
                            {item.status}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteEmi(item.id)}
                            className="p-1 rounded-lg text-[#9ca3af] hover:text-[#f87171] hover:bg-[#f87171]/10 transition"
                            title="Delete from database"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Transaction Ledger Banner (Bottom of Services Page) ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c101c]/80 p-4 sm:p-5 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#182033] border border-[#fbbf24]/20 text-[#fbbf24]">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm sm:text-base font-bold text-[#f1f5f3]">
              Transaction Ledger
            </p>
            <p className="text-[11px] sm:text-xs text-[#9ca3af]">
              View, filter, and inspect all recorded transactions & monthly ledgers
            </p>
          </div>
        </div>

        <Link
          href="/expenses"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d97706] to-[#fbbf24] px-4 py-2 text-xs font-bold text-[#080c14] shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:opacity-95 active:scale-95 transition shrink-0"
        >
          <span>Open Ledger</span>
          <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
        </Link>
      </div>
    </div>
  );
}














function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const finance = useFinance();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const path = !user ? '/login' : location.startsWith('/add-expense/') ? '/edit-expense' : location;
    const page = PAGE_TITLES[path];
    document.title = page ? `${page} · Spendly` : DEFAULT_TITLE;
  }, [location, user]);

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
          <Route path="/"><HomePage finance={finance} theme={theme} toggleTheme={toggleTheme} /></Route>
          <Route path="/expenses"><ExpensesPage finance={finance} /></Route>
          <Route path="/add-expense/:id"><ExpenseFormPage finance={finance} /></Route>
          <Route path="/add-expense"><ExpenseFormPage finance={finance} /></Route>
          <Route path="/summary"><SummaryPage finance={finance} /></Route>
          <Route path="/services/:subpage"><ServicesPage /></Route>
          <Route path="/services"><ServicesPage /></Route>
          <Route path="/settings"><SettingsPage finance={finance} theme={theme} toggleTheme={toggleTheme} /></Route>
          <Route path="/login"><LoginPage /></Route>
          <Route path="/signup"><LoginPage /></Route>
          <Route><NotFound /></Route>
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