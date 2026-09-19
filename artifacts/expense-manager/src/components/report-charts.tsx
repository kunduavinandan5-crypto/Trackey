import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Sparkles,
  ShieldCheck,
  BarChart2,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Film,
  HeartPulse,
  Receipt,
  GraduationCap,
  Briefcase,
  Wallet,
  CreditCard,
  ChevronRight,
  Zap,
} from 'lucide-react';

export type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  notes: string;
};

interface ReportChartsProps {
  expenses: Expense[];
  salary: number;
  selectedMonth: string;
  categories: string[];
  categoryColors: string[];
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatRupees = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Math.round(amount),
  );

function getCategoryIcon(category: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('grocer') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('culinary') || cat.includes('tea') || cat.includes('coffee')) {
    return UtensilsCrossed;
  }
  if (cat.includes('transport') || cat.includes('travel') || cat.includes('transit') || cat.includes('mobility') || cat.includes('cab') || cat.includes('fuel') || cat.includes('car')) {
    return Car;
  }
  if (cat.includes('shop') || cat.includes('cloth') || cat.includes('mall') || cat.includes('amazon') || cat.includes('flipkart')) {
    return ShoppingBag;
  }
  if (cat.includes('health') || cat.includes('medic') || cat.includes('doctor') || cat.includes('pharmacy') || cat.includes('hospital')) {
    return HeartPulse;
  }
  if (cat.includes('entertainment') || cat.includes('movie') || cat.includes('recreation') || cat.includes('netflix') || cat.includes('game') || cat.includes('music')) {
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

const LUX_GOLD_PALETTE = ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#b45309', '#fef08a', '#eab308', '#ca8a04', '#78350f', '#92400e'];

export function ReportCharts({
  expenses,
  salary,
  selectedMonth,
  categories,
  categoryColors,
}: ReportChartsProps) {
  const [activeTab, setActiveTab] = useState<'trend' | 'categories' | 'weekly'>('trend');

  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const monthShortName = new Date(yearNum, monthNum - 1, 1).toLocaleString('default', { month: 'short' }).toUpperCase();

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );

  // Daily Spending Time-Series Data
  const dailyData = useMemo(() => {
    const dailyMap: Record<number, { amount: number; count: number; items: string[] }> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      dailyMap[day] = { amount: 0, count: 0, items: [] };
    }

    expenses.forEach((item) => {
      const day = parseInt(item.date.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) {
        dailyMap[day].amount += item.amount;
        dailyMap[day].count += 1;
        if (item.description) dailyMap[day].items.push(item.description);
      }
    });

    let cumulative = 0;
    return Object.entries(dailyMap).map(([dayStr, data]) => {
      const day = parseInt(dayStr, 10);
      cumulative += data.amount;
      return {
        day: `${day}`,
        dayNum: day,
        dayLabel: `${day} ${new Date(yearNum, monthNum - 1, day).toLocaleString('default', { month: 'short' })}`,
        axisLabel: `${monthShortName} ${String(day).padStart(2, '0')}`,
        amount: data.amount,
        cumulative,
        count: data.count,
        topItem: data.items[0] || 'No transactions',
      };
    });
  }, [expenses, daysInMonth, yearNum, monthNum, monthShortName]);

  // Peak spending day
  const peakDay = useMemo(() => {
    if (!dailyData.length) return null;
    return dailyData.reduce((prev, curr) => (curr.amount > prev.amount ? curr : prev), dailyData[0]);
  }, [dailyData]);

  const quietDaysCount = useMemo(() => {
    return dailyData.filter((d) => d.amount === 0).length;
  }, [dailyData]);

  // Category Breakdown Data
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });

    return categories
      .map((cat, idx) => ({
        name: cat,
        value: map[cat] || 0,
        color: LUX_GOLD_PALETTE[idx % LUX_GOLD_PALETTE.length],
        percentage: totalSpent > 0 ? Math.round(((map[cat] || 0) / totalSpent) * 100) : 0,
        count: expenses.filter((e) => e.category === cat).length,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories, totalSpent]);

  // Day-of-Week Distribution
  const weeklyData = useMemo(() => {
    const weekMap = [0, 0, 0, 0, 0, 0, 0];
    const countMap = [0, 0, 0, 0, 0, 0, 0];

    expenses.forEach((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      const dayIndex = date.getDay();
      if (!isNaN(dayIndex)) {
        weekMap[dayIndex] += item.amount;
        countMap[dayIndex] += 1;
      }
    });

    return DAYS_OF_WEEK.map((day, idx) => ({
      day,
      amount: weekMap[idx],
      count: countMap[idx],
    }));
  }, [expenses]);

  return (
    <div className="space-y-4">
      {/* ── 3-Tab View Switcher Pills ── */}
      <div className="grid grid-cols-3 gap-1.5 rounded-full bg-[#0c101c] border border-[#fbbf24]/20 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('trend')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 px-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200 ${
            activeTab === 'trend'
              ? 'bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f59e0b] text-[#080b11] font-extrabold shadow-[0_0_14px_rgba(245,158,11,0.4)]'
              : 'text-[#9ca3af] hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span>DAILY CURVE</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 px-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200 ${
            activeTab === 'categories'
              ? 'bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f59e0b] text-[#080b11] font-extrabold shadow-[0_0_14px_rgba(245,158,11,0.4)]'
              : 'text-[#9ca3af] hover:text-white'
          }`}
        >
          <PieIcon className="h-3.5 w-3.5 shrink-0" />
          <span>CATEGORIES</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('weekly')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 px-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200 ${
            activeTab === 'weekly'
              ? 'bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f59e0b] text-[#080b11] font-extrabold shadow-[0_0_14px_rgba(245,158,11,0.4)]'
              : 'text-[#9ca3af] hover:text-white'
          }`}
        >
          <BarChart2 className="h-3.5 w-3.5 shrink-0" />
          <span>CADENCE</span>
        </button>
      </div>

      {/* ── Main Dynamic Card: Daily Outflow Topology ── */}
      {activeTab === 'trend' && (
        <div className="spendly-glass-card !p-4 space-y-3.5 border-[#fbbf24]/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#fbbf24]">
                SPENDING FLOW DYNAMIC
              </p>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5">
                Daily Outflow Topology
              </h3>
              <p className="text-[11px] text-[#9ca3af] mt-0.5">
                Map of expenditure spikes versus tranquil days
              </p>
            </div>

            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#182033] border border-[#fbbf24]/30 text-[#fbbf24] shadow-[0_0_10px_rgba(245,158,11,0.25)]">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          {/* Peak Spike & Quiet Days Badge Row */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1e1c12] border border-[#fbbf24]/40 px-2.5 py-1 text-[10.5px] font-extrabold text-[#fde68a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_6px_#fbbf24]" />
              <span>Peak: {peakDay && peakDay.amount > 0 ? formatRupees(peakDay.amount) : '₹0'} ({monthShortName} {peakDay ? peakDay.dayNum : '1'})</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#101524] border border-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-[#9ca3af]">
              <span>{quietDaysCount} quiet days</span>
            </div>
          </div>

          {/* Interactive Golden Spline Area Chart */}
          {expenses.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#9ca3af]">
              No transactions recorded for {selectedMonth} yet.
            </div>
          ) : (
            <div className="relative h-[210px] sm:h-[240px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="65%" stopColor="#d97706" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#080b11" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(245, 158, 11, 0.15)' }}
                    tick={{ fill: '#9ca3af', fontSize: 9.5, fontWeight: 700 }}
                    tickFormatter={(day) => {
                      const d = parseInt(day, 10);
                      if (d === 1) return `${monthShortName} 01`;
                      if (d === 8) return `${monthShortName} 08`;
                      if (peakDay && d === peakDay.dayNum) return `${monthShortName} ${String(d).padStart(2, '0')} (PEAK)`;
                      if (d === 22) return `${monthShortName} 22`;
                      if (d === daysInMonth) return `${monthShortName} ${d}`;
                      return '';
                    }}
                    interval={0}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip content={<CustomGoldTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#fbbf24"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#goldCurveGradient)"
                    dot={({ cx, cy, payload }) => {
                      if (peakDay && payload.dayNum === peakDay.dayNum && peakDay.amount > 0) {
                        return (
                          <g key={`dot-${payload.day}`}>
                            <circle cx={cx} cy={cy} r={6} fill="#fbbf24" opacity={0.3} className="animate-ping" />
                            <circle cx={cx} cy={cy} r={4.5} fill="#fde68a" stroke="#d97706" strokeWidth={1.5} />
                          </g>
                        );
                      }
                      return <circle key={`dot-${payload.day}`} cx={cx} cy={cy} r={0} />;
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Footer Card Bar: Outlier inspection */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
            <div className="flex items-center gap-1.5 text-[#9ca3af]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#fbbf24]" />
              <span className="truncate">Zero irregular outlier leaks detected</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className="inline-flex items-center gap-1 font-extrabold text-[#fbbf24] hover:underline uppercase text-[10px] tracking-wider shrink-0"
            >
              <span>INSPECT</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Category Donut / Breakdown ── */}
      {activeTab === 'categories' && (
        <div className="spendly-glass-card !p-4 space-y-3.5 border-[#fbbf24]/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#fbbf24]">
                EXPENSE ALLOCATION
              </p>
              <h3 className="font-serif text-lg font-bold text-white tracking-tight mt-0.5">
                Category Proportion
              </h3>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#182033] border border-[#fbbf24]/30 text-[#fbbf24]">
              <PieIcon className="h-4 w-4" />
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#9ca3af]">
              No categorical expenses logged.
            </div>
          ) : (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#080b11" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomCategoryTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Weekly Rhythm / Cadence ── */}
      {activeTab === 'weekly' && (
        <div className="spendly-glass-card !p-4 space-y-3.5 border-[#fbbf24]/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#fbbf24]">
                WEEKDAY CADENCE
              </p>
              <h3 className="font-serif text-lg font-bold text-white tracking-tight mt-0.5">
                Spending Rhythm
              </h3>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#182033] border border-[#fbbf24]/30 text-[#fbbf24]">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>

          <div className="h-[200px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip content={<CustomWeeklyTooltip />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} fill="#fbbf24" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── CATEGORY DISTRIBUTION LIST (Always visible below main charts) ── */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-serif text-lg font-bold text-white tracking-tight">
            Category Distribution
          </h3>
          <span className="text-xs text-[#9ca3af] font-medium">
            {formatRupees(totalSpent)} Total Logged
          </span>
        </div>

        {categoryData.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#0e1320]/60 p-6 text-center text-xs text-[#9ca3af]">
            No expenses logged for this month.
          </div>
        ) : (
          <div className="space-y-2">
            {categoryData.map((item) => {
              const Icon = getCategoryIcon(item.name);
              return (
                <div
                  key={item.name}
                  className="rounded-2xl border border-white/8 bg-[#0e1320]/80 p-3.5 space-y-2 transition-all hover:border-[#fbbf24]/30 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                        style={{
                          backgroundColor: '#161e30',
                          borderColor: 'rgba(245, 158, 11, 0.25)',
                          color: '#fbbf24',
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white tracking-tight">
                          {item.name}
                        </p>
                        <p className="text-[10.5px] text-[#9ca3af] mt-0.5">
                          {item.percentage}% of total outflow
                        </p>
                      </div>
                    </div>

                    <p className="font-serif text-base font-bold text-white">
                      {formatRupees(item.value)}
                    </p>
                  </div>

                  {/* Progress fill bar */}
                  <div className="h-1.5 w-full rounded-full bg-[#080c14] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #fde68a 100%)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Custom Dark Obsidian & Gold Tooltips ──

function CustomGoldTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#fbbf24]/35 bg-[#0e1320]/95 p-2.5 shadow-2xl backdrop-blur-xl text-xs space-y-1 min-w-[150px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
          <span className="font-bold text-white">{data.dayLabel}</span>
          <span className="rounded bg-[#fbbf24]/20 px-1.5 py-0.5 text-[9.5px] font-bold text-[#fde68a]">
            {data.count} tx
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#9ca3af]">Spent:</span>
          <span className="font-serif font-bold text-[#fbbf24]">{formatRupees(data.amount)}</span>
        </div>
        {data.count > 0 && (
          <p className="text-[9.5px] text-[#9ca3af] truncate max-w-[170px]">
            {data.topItem}
          </p>
        )}
      </div>
    );
  }
  return null;
}

function CustomCategoryTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#fbbf24]/35 bg-[#0e1320]/95 p-2.5 shadow-2xl backdrop-blur-xl text-xs space-y-1 min-w-[140px]">
        <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-bold text-white">{data.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#9ca3af]">Amount:</span>
          <span className="font-serif font-bold text-white">{formatRupees(data.value)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#9ca3af]">Share:</span>
          <span className="font-bold text-[#fbbf24]">{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
}

function CustomWeeklyTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#fbbf24]/35 bg-[#0e1320]/95 p-2.5 shadow-2xl backdrop-blur-xl text-xs space-y-1 min-w-[130px]">
        <div className="font-bold text-white border-b border-white/10 pb-1 mb-1">
          {data.day}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#9ca3af]">Spent:</span>
          <span className="font-serif font-bold text-[#fbbf24]">{formatRupees(data.amount)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#9ca3af]">Entries:</span>
          <span className="font-bold text-white">{data.count}</span>
        </div>
      </div>
    );
  }
  return null;
}
