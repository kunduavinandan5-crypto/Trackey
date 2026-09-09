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
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
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
      full_name: fullName,
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
export async function fetchUserExpenses(userId: string) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.warn('[Supabase] Error fetching expenses:', error.message);
      return null;
    }
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Exception fetching expenses:', err);
    return null;
  }
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
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('salaries')
      .select('month, amount')
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase] Error fetching salaries:', error.message);
      return null;
    }

    const salaryMap: Record<string, number> = {};
    for (const item of data || []) {
      salaryMap[item.month] = Number(item.amount);
    }
    return salaryMap;
  } catch (err) {
    console.warn('[Supabase] Exception fetching salaries:', err);
    return null;
  }
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
