import { type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Edit3,
  Filter,
  Home as HomeIcon,
  Moon,
  Plus,
  ReceiptIndianRupee,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Tag,
  Trash2,
  TrendingDown,
  Upload,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';

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
  customCategories: string[];
};

const STORAGE_KEY = 'paisa-pocket-finance-v1';
const THEME_KEY = 'paisa-theme-preference';
const BASE_CATEGORIES = ['Food', 'Rent', 'Travel', 'Shopping', 'Bills', 'Education', 'Health', 'Entertainment', 'Work', 'Other'];
const CATEGORY_COLORS = ['#27877d', '#e18562', '#d3a53c', '#6f567a', '#4f9a9d', '#d77e99', '#739359', '#bb7650', '#53749b', '#9c8b6e'];

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

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const fallbackStore: FinanceStore = { expenses: [], salaries: {}, customCategories: [] };

function loadStore(): FinanceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallbackStore;
    const parsed = JSON.parse(raw) as Partial<FinanceStore>;
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      salaries: parsed.salaries && typeof parsed.salaries === 'object' ? parsed.salaries : {},
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    };
  } catch {
    return fallbackStore;
  }
}

// Custom hook for theme management (Light / Dark)
function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_KEY);
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
  const [store, setStore] = useState<FinanceStore>(loadStore);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'danger' } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const categories = [...BASE_CATEGORIES, ...store.customCategories.filter((c) => !BASE_CATEGORIES.includes(c))];
  const notify = (message: string, kind: 'success' | 'danger' = 'success') => setToast({ message, kind });

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    setStore((current) => ({ ...current, expenses: [{ ...expense, id: uid() }, ...current.expenses] }));
    notify('Expense tucked away.');
  };

  const updateExpense = (id: string, changes: Omit<Expense, 'id'>) => {
    setStore((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => (expense.id === id ? { ...changes, id } : expense)),
    }));
    notify('Expense updated.');
  };

  const deleteExpense = (id: string) => {
    setStore((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }));
    notify('Expense removed.', 'danger');
  };

  const setSalary = (month: string, salary: number) => {
    setStore((current) => ({ ...current, salaries: { ...current.salaries, [month]: salary } }));
    notify(`${monthLabel(month)} salary saved.`);
  };

  const addCategory = (category: string) => {
    const clean = category.trim();
    if (!clean || categories.includes(clean)) return false;
    setStore((current) => ({ ...current, customCategories: [...current.customCategories, clean] }));
    notify('New category added.');
    return true;
  };

  const removeCategory = (category: string) => {
    setStore((current) => ({ ...current, customCategories: current.customCategories.filter((item) => item !== category) }));
    notify('Category removed.');
  };

  const importStore = (imported: Partial<FinanceStore>) => {
    try {
      const expenses = Array.isArray(imported.expenses) ? imported.expenses : [];
      const salaries = imported.salaries && typeof imported.salaries === 'object' ? imported.salaries : {};
      const customCategories = Array.isArray(imported.customCategories) ? imported.customCategories : [];
      setStore({ expenses, salaries, customCategories });
      notify('Backup restored successfully!');
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

  return { store, categories, toast, addExpense, updateExpense, deleteExpense, setSalary, addCategory, removeCategory, importStore, reset };
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
  const [location] = useLocation();

  // Scroll-hide behaviour
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const current = window.scrollY;
        if (current > lastScrollY.current + 10 && current > 60) setNavHidden(true);
        else if (current < lastScrollY.current - 6) setNavHidden(false);
        lastScrollY.current = current;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { href: '/', label: 'Overview', icon: HomeIcon },
    { href: '/expenses', label: 'Expenses', icon: ClipboardList },
    { href: '/summary', label: 'Summary', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="app-grain min-h-[100dvh] bg-background text-foreground transition-colors duration-200">

      {/* ── Single Floating Navbar ── */}
      <header className={`floating-nav-top flex${navHidden ? ' floating-nav-top--hidden' : ''}`}>
        <nav className="floating-nav-pill" aria-label="Primary navigation">
          <Brand compact />
          <div className="floating-nav-divider" />
          {navItems.map((item) => (
            <FloatingNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} active={location === item.href} />
          ))}
          <div className="floating-nav-divider" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="floating-nav-theme-btn"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/add-expense"
            data-testid="link-desktop-add"
            aria-label="Add expense"
            className="floating-nav-add-btn"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Link>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto min-h-[100dvh] max-w-[1420px] px-4 pt-24 pb-16 sm:px-8 sm:pt-28 lg:px-12">
        {children}
      </main>

      {/* Floating Toast */}
      {toast && (
        <div
          role="status"
          data-testid="status-toast"
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-2xl ${
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
    <Link href="/" data-testid="link-brand" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-accent text-foreground shadow-sm">
        <ReceiptIndianRupee className="h-5 w-5" />
      </span>
      <span className={`${compact ? 'text-lg' : 'text-xl'} font-display font-semibold tracking-tight`}>
        paisa<span className="text-accent">.</span>
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
      <span className="hidden sm:inline">{label}</span>
    </Link>
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
    mint: 'bg-[#d8eee3] text-[#123832] dark:bg-[#1a3832] dark:text-[#a8d8bd]',
    coral: 'bg-[#f4d8cc] text-[#4a2218] dark:bg-[#3d241d] dark:text-[#f4b8a5]',
    cream: 'bg-[#f0e6c7] text-[#423315] dark:bg-[#38311d] dark:text-[#f0d99d]',
    plum: 'bg-[#e6ddea] text-[#3b2746] dark:bg-[#34243d] dark:text-[#d9c4e2]',
  };
  return (
    <article data-testid={testId} className={`rise-in rounded-2xl p-5 ${tones[tone]} border border-border/40`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[.14em] opacity-80">{label}</span>
        <Icon className="h-5 w-5 opacity-75" />
      </div>
      <p className="mt-5 font-display text-3xl tracking-tight sm:text-[2.1rem]">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </article>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            testId="metric-salary"
            label="Monthly salary"
            value={rupees(salary)}
            detail={salary ? 'Your take-home for this month' : 'Add a salary to see your balance'}
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
            detail={balance < 0 ? 'A gentle nudge to pause' : `${Math.max(0, 100 - percent)}% of salary remains`}
            icon={balance < 0 ? CircleAlert : CircleDollarSign}
            tone={balance < 0 ? 'coral' : 'cream'}
          />
          <MetricCard
            testId="metric-progress"
            label="Spent percentage"
            value={`${percent}%`}
            detail={salary ? (percent > 100 ? 'This month needs a reset' : 'A useful pace to notice') : 'Set salary to calculate'}
            icon={BarChart3}
            tone="plum"
          />
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
      className={`rise-in stagger-${Math.min(index + 1, 5)} group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/60 ${compact ? '' : 'border-b border-border/60'
        }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ backgroundColor: `${color}20`, color }}>
        {expense.category.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{expense.description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {expense.category} <span className="px-1">·</span> {shortDate(expense.date)}
        </p>
      </div>
      <p className="font-mono-ui text-sm font-medium">{rupees(expense.amount)}</p>
      {(onEdit || onDelete) && (
        <div className="ml-2 hidden items-center gap-1 group-hover:flex">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${expense.description}`}
            data-testid={`button-edit-${expense.id}`}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${expense.description}`}
            data-testid={`button-delete-${expense.id}`}
            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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

  const valid = Number(amount) > 0 && description.trim().length > 0 && date;

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
  );
}

function SummaryPage({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const salary = finance.store.salaries[selectedMonth] ?? 0;
  const expenses = finance.store.expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth);
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = salary - spent;
  const grouped = finance.categories
    .map((category, index) => ({
      category,
      amount: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const max = Math.max(...grouped.map((item) => item.amount), 1);

  return (
    <div className="page-enter">
      <PageIntro
        eyebrow="Patterns, not pressure"
        title="The month in full."
        description="A calm read on where your money went, and what’s still available."
        action={<MonthPicker value={selectedMonth} onChange={setSelectedMonth} />}
      />

      {spent > salary && salary > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold">This month is over its salary by {rupees(spent - salary)}.</p>
            <p className="mt-1 text-muted-foreground">No shame in the number — it’s simply asking for your attention.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          detail={`${expenses.length} transactions`}
          icon={CreditCard}
          tone="coral"
        />
        <MetricCard
          testId="summary-balance"
          label={balance < 0 ? 'Over by' : 'Balance'}
          value={rupees(Math.abs(balance))}
          detail={balance < 0 ? 'Needs a closer look' : 'Available after expenses'}
          icon={balance < 0 ? ArrowDownRight : ArrowUpRight}
          tone={balance < 0 ? 'coral' : 'cream'}
        />
        <MetricCard
          testId="summary-average"
          label="Average spend"
          value={expenses.length ? rupees(spent / expenses.length) : '₹0'}
          detail="Per transaction"
          icon={TrendingDown}
          tone="plum"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary">The shape of it</p>
              <h2 className="mt-1 font-display text-2xl">By category</h2>
            </div>
            <Tag className="h-5 w-5 text-muted-foreground" />
          </div>
          {grouped.length ? (
            <div className="mt-7 space-y-5">
              {grouped.map((item, index) => (
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
                      style={{ width: `${(item.amount / max) * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyExpenses compact />
          )}
        </section>

        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-primary">A useful number</p>
            <h2 className="mt-1 font-display text-2xl">Your balance</h2>
          </div>
          <div className="mt-8 rounded-2xl bg-sidebar p-6 text-sidebar-foreground">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-sidebar-foreground/50">
              {balance < 0 ? 'Needs a reset' : 'Left after spending'}
            </p>
            <p data-testid="summary-balance-value" className={`mt-3 font-display text-4xl ${balance < 0 ? 'text-[#f19a78]' : 'text-[#a8d8bd]'}`}>
              {rupees(Math.abs(balance))}
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-sidebar-foreground/15">
              <div
                className={`h-full rounded-full ${balance < 0 ? 'bg-[#f19a78]' : 'bg-[#a8d8bd]'}`}
                style={{ width: `${salary ? Math.min(Math.max((spent / salary) * 100, 4), 100) : 4}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-sidebar-foreground/55">
              {salary ? `${Math.round((spent / salary) * 100)}% of your salary has found a destination.` : 'Set a salary to make this number more meaningful.'}
            </p>
          </div>
          <Link
            href="/expenses"
            data-testid="link-summary-transactions"
            className="mt-5 flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm font-bold transition hover:bg-border"
          >
            <span>Review transactions</span>
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </Link>
        </section>
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
  const [month, setMonth] = useState(monthKey());
  const [salary, setSalaryValue] = useState(String(finance.store.salaries[month] ?? ''));
  const [newCategory, setNewCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSalaryValue(finance.store.salaries[month] ? String(finance.store.salaries[month]) : '');
  }, [finance.store.salaries, month]);

  const save = () => {
    if (Number(salary) > 0) finance.setSalary(month, Number(salary));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(finance.store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `paisa-backup-${monthKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        finance.importStore(parsed);
      } catch {
        alert('Invalid backup file. Please provide a valid JSON backup.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page-enter max-w-4xl space-y-6">
      <PageIntro eyebrow="Your space" title="Settings." description="Keep your monthly context, private categories, and app preferences up to date." />

      {/* Salary Configuration */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#d8eee3] text-primary dark:bg-[#1a3832] dark:text-[#a8d8bd]">
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
            <span key={category} className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-2 text-xs font-semibold">
              {category}
              {!BASE_CATEGORIES.includes(category) && (
                <button
                  type="button"
                  aria-label={`Remove ${category}`}
                  data-testid={`button-remove-category-${category}`}
                  onClick={() => finance.removeCategory(category)}
                  className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
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
            <p className="mt-1 text-sm text-muted-foreground">Customize appearance and install Paisa on your device.</p>
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

      {/* Local Data & Backup */}
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f0e6c7] text-[#96732a] dark:bg-[#38311d] dark:text-[#f0d99d]">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">Local data & Backups</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything is stored privately on this device. Export a backup anytime or transfer to another device.</p>
          </div>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" aria-label="Upload backup JSON" />

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData} testId="button-export-data">
            <ArrowUpRight className="h-4 w-4" /> Export backup (.json)
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} testId="button-import-data">
            <Upload className="h-4 w-4" /> Restore backup
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              if (window.confirm('Clear all local salary, expense, and category data?')) finance.reset();
            }}
            testId="button-reset-data"
          >
            <RotateCcw className="h-4 w-4" /> Reset all data
          </Button>
        </div>
      </section>
    </div>
  );
}

function Router() {
  const finance = useFinance();
  const { theme, toggleTheme } = useTheme();
  return (
    <AppShell toast={finance.toast} theme={theme} toggleTheme={toggleTheme}>
      <ErrorBoundary resetKey={location.pathname}>
        <Switch>
          <Route path="/" component={() => <HomePage finance={finance} />} />
          <Route path="/expenses" component={() => <ExpensesPage finance={finance} />} />
          <Route path="/add-expense/:id" component={() => <ExpenseFormPage finance={finance} />} />
          <Route path="/add-expense" component={() => <ExpenseFormPage finance={finance} />} />
          <Route path="/summary" component={() => <SummaryPage finance={finance} />} />
          <Route path="/settings" component={() => <SettingsPage finance={finance} theme={theme} toggleTheme={toggleTheme} />} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Router />
    </WouterRouter>
  );
}

export default App;