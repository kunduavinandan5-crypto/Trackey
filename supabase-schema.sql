-- ==============================================================================
-- TRACKEY / PAISA EXPENSE MANAGER - SUPABASE DATABASE SCHEMA
-- Separate tables for: Profiles, Expenses, Salaries, User Logins
-- Run this SQL in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. PROFILES TABLE
-- Stores user personal profile details linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. EXPENSES TABLE
-- Stores each user's expense entries
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL, -- Format: YYYY-MM-DD
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- Enable RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- 3. SALARIES TABLE
-- Stores monthly salary / income entries per user
CREATE TABLE IF NOT EXISTS public.salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM (e.g. 2026-09)
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_salaries_user_id ON public.salaries(user_id);

-- Enable RLS for salaries
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own salaries"
  ON public.salaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own salaries"
  ON public.salaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own salaries"
  ON public.salaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own salaries"
  ON public.salaries FOR DELETE
  USING (auth.uid() = user_id);

-- 4. USER LOGINS TABLE
-- Stores login history / audit log for each user session
CREATE TABLE IF NOT EXISTS public.user_logins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT,
  user_agent TEXT,
  login_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_logins_user_id ON public.user_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logins_login_at ON public.user_logins(login_at);

-- Enable RLS for user_logins
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login events"
  ON public.user_logins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login event"
  ON public.user_logins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. AUTOMATIC TRIGGER FOR PROFILE CREATION ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and recreate cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
