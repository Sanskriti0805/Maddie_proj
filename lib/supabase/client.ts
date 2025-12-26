import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Check if we're in build phase (Next.js sets this during build)
// Also check for common build environment indicators
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                     process.env.NEXT_PHASE === 'phase-development-build' ||
                     process.env.NEXT_PHASE === 'phase-production-server' ||
                     // During build, API routes might be analyzed but env vars not available
                     (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NODE_ENV === 'production');

// Lazy client creation to avoid errors during build time
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    if (isBuildPhase) {
      // During build, use placeholder to avoid errors
      return 'https://placeholder.supabase.co';
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    if (isBuildPhase) {
      // During build, use placeholder to avoid errors
      return 'placeholder-key';
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return key;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    if (!supabaseInstance) {
      const url = getSupabaseUrl();
      const key = getSupabaseAnonKey();
      supabaseInstance = createClient<Database>(url, key);
    }
    const value = supabaseInstance[prop as keyof typeof supabaseInstance];
    return typeof value === 'function' ? value.bind(supabaseInstance) : value;
  },
});

// Server-side client with service role key (for admin operations)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // During build time, use placeholders to avoid errors
  if (isBuildPhase) {
    return createClient<Database>(
      supabaseUrl || 'https://placeholder.supabase.co',
      serviceRoleKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  
  // In runtime, validate env vars
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

