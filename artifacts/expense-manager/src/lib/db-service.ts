import { supabase, isSupabaseConfigured } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface DbExpense {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbLoginRecord {
  id?: string;
  user_id: string;
  email?: string;
  user_agent?: string;
  login_at?: string;
}

export interface DbSalary {
  id?: string;
  user_id: string;
  month: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Checks if user is an authentic Supabase UUID user (not a demo/guest user).
 */
export function isRealSupabaseUser(user: { id: string } | null | undefined): boolean {
  if (!isSupabaseConfigured || !user || !user.id) return false;
  // Supabase Auth user IDs are RFC 4122 UUIDs
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
}

// -----------------------------------------------------------------------------
// 1. USER LOGINS (Separate table: public.user_logins)
// -----------------------------------------------------------------------------
export async function recordUserLogin(user: User): Promise<void> {
  if (!isRealSupabaseUser(user)) return;
  try {
    const { error } = await supabase.from('user_logins').insert([
      {
        user_id: user.id,
        email: user.email || '',
        user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown').slice(0, 512),
        login_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.warn('[Supabase] Failed to log user login session:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Error recording user login:', err);
  }
}

// -----------------------------------------------------------------------------
// 2. USER PROFILES (Separate table: public.profiles)
// -----------------------------------------------------------------------------
export async function upsertUserProfile(user: User, customName?: string): Promise<DbProfile | null> {
  if (!isRealSupabaseUser(user)) return null;
  try {
    const fullName =
      customName ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const profileData = {
      id: user.id,
      email: user.email || '',
      full_name: String(fullName).trim().slice(0, 120),
      avatar_url: user.user_metadata?.avatar_url || '',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Profile upsert warning:', error.message);
      return null;
    }
    return data as DbProfile;
  } catch (err) {
    console.warn('[Supabase] Error upserting profile:', err);
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<DbProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Error fetching profile:', error.message);
      return null;
    }
    return data as DbProfile | null;
  } catch (err) {
    console.warn('[Supabase] Error reading profile:', err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 3. EXPENSES (Separate table: public.expenses)
// -----------------------------------------------------------------------------
export async function fetchUserExpenses(userId: string): Promise<DbExpense[] | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return [];
  
  // Try up to 2 times with a slight delay in case auth token is in flight
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.warn(`[Supabase] Error fetching expenses (attempt ${attempt}):`, error.message);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        return null;
      }
      return (data as DbExpense[]) || [];
    } catch (err) {
      console.warn(`[Supabase] Exception fetching expenses (attempt ${attempt}):`, err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function saveExpenseToDb(
  userId: string,
  expense: { id: string; amount: number; description: string; category: string; date: string; notes?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('expenses').upsert(
      {
        id: expense.id,
        user_id: userId,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        notes: expense.notes || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('[Supabase] Error saving expense:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception saving expense:', err);
    return false;
  }
}

export async function deleteExpenseFromDb(userId: string, expenseId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase] Error deleting expense:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception deleting expense:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// 4. SALARIES (Separate table: public.salaries)
// -----------------------------------------------------------------------------
export async function fetchUserSalaries(userId: string): Promise<Record<string, number> | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return null;
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select('month, amount')
        .eq('user_id', userId);

      if (error) {
        console.warn(`[Supabase] Error fetching salaries (attempt ${attempt}):`, error.message);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        return null;
      }

      const salaryMap: Record<string, number> = {};
      for (const item of data || []) {
        salaryMap[item.month] = Number(item.amount);
      }
      return salaryMap;
    } catch (err) {
      console.warn(`[Supabase] Exception fetching salaries (attempt ${attempt}):`, err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function saveSalaryToDb(userId: string, month: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('salaries').upsert(
      {
        user_id: userId,
        month,
        amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month' }
    );
    if (error) {
      console.warn('[Supabase] Error saving salary:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception saving salary:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// 5. FINANCIAL SERVICES: LENDING, CASH, LOANS, EMI
// -----------------------------------------------------------------------------

export interface DbLending {
  id: string;
  user_id: string;
  person_name: string;
  amount: number;
  type: 'lent' | 'borrowed';
  due_date?: string;
  status: 'pending' | 'settled' | 'overdue';
  notes?: string;
}

export interface DbCash {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'in' | 'out';
  date: string;
  wallet_location?: string;
  notes?: string;
}

export interface DbLoan {
  id: string;
  user_id: string;
  lender_name: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  outstanding_balance: number;
  start_date?: string;
  status: 'active' | 'closed';
  notes?: string;
}

export interface DbEmi {
  id: string;
  user_id: string;
  loan_or_item: string;
  monthly_amount: number;
  due_day: number;
  total_installments: number;
  remaining_installments: number;
  auto_debit: boolean;
  status: 'ongoing' | 'completed';
  notes?: string;
}

// 5.1 Lending CRUD
export async function fetchUserLending(userId: string): Promise<DbLending[] | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return [];
  try {
    const { data, error } = await supabase
      .from('lending_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase] Error fetching lending:', error.message);
      return null;
    }
    return (data as DbLending[]) || [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching lending:', err);
    return null;
  }
}

export async function saveLendingToDb(userId: string, item: Omit<DbLending, 'user_id'>): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('lending_records').upsert(
      {
        id: item.id,
        user_id: userId,
        person_name: item.person_name,
        amount: item.amount,
        type: item.type,
        due_date: item.due_date || null,
        status: item.status,
        notes: item.notes || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('[Supabase] Error saving lending record:', error.message, error.details);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception saving lending record:', err);
    return false;
  }
}

export async function deleteLendingFromDb(userId: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('lending_records').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.warn('[Supabase] Error deleting lending record:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Exception deleting lending record:', err);
    return false;
  }
}

// 5.2 Cash CRUD
export async function fetchUserCash(userId: string): Promise<DbCash[] | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return [];
  try {
    const { data, error } = await supabase
      .from('cash_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) {
      console.warn('[Supabase] Error fetching cash records:', error.message);
      return null;
    }
    return (data as DbCash[]) || [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching cash records:', err);
    return null;
  }
}

export async function saveCashToDb(userId: string, item: Omit<DbCash, 'user_id'>): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('cash_records').upsert(
      {
        id: item.id,
        user_id: userId,
        description: item.description,
        amount: item.amount,
        type: item.type,
        date: item.date,
        wallet_location: item.wallet_location || 'Wallet',
        notes: item.notes || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteCashFromDb(userId: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('cash_records').delete().eq('id', id).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

// 5.3 Loans CRUD
export async function fetchUserLoans(userId: string): Promise<DbLoan[] | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return [];
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase] Error fetching loans:', error.message);
      return null;
    }
    return (data as DbLoan[]) || [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching loans:', err);
    return null;
  }
}

export async function saveLoanToDb(userId: string, item: Omit<DbLoan, 'user_id'>): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('loans').upsert(
      {
        id: item.id,
        user_id: userId,
        lender_name: item.lender_name,
        principal_amount: item.principal_amount,
        interest_rate: item.interest_rate,
        tenure_months: item.tenure_months,
        outstanding_balance: item.outstanding_balance,
        start_date: item.start_date || null,
        status: item.status,
        notes: item.notes || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteLoanFromDb(userId: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('loans').delete().eq('id', id).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

// 5.4 EMI CRUD
export async function fetchUserEmis(userId: string): Promise<DbEmi[] | null> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return [];
  try {
    const { data, error } = await supabase
      .from('emi_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('due_day', { ascending: true });
    if (error) {
      console.warn('[Supabase] Error fetching emi schedules:', error.message);
      return null;
    }
    return (data as DbEmi[]) || [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching emi schedules:', err);
    return null;
  }
}

export async function saveEmiToDb(userId: string, item: Omit<DbEmi, 'user_id'>): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('emi_schedules').upsert(
      {
        id: item.id,
        user_id: userId,
        loan_or_item: item.loan_or_item,
        monthly_amount: item.monthly_amount,
        due_day: item.due_day,
        total_installments: item.total_installments,
        remaining_installments: item.remaining_installments,
        auto_debit: item.auto_debit,
        status: item.status,
        notes: item.notes || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteEmiFromDb(userId: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !isRealSupabaseUser({ id: userId })) return false;
  try {
    const { error } = await supabase.from('emi_schedules').delete().eq('id', id).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
