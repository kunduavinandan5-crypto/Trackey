import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ytnrtpaavuvrufbjqgfe.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bnJ0cGFhdnV2cnVmYmpxZ2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzg4NzAsImV4cCI6MjEwNDQ1NDg3MH0.NpevKARacYjbS-KndRWr9MHParKp8TDinwdgtzFJarM';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

// Fallback dummy credentials when not configured so createClient does not crash
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
